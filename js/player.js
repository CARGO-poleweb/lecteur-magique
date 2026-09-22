/**
 * Le lecteur : enchaîne les répliques, chacune avec la voix de son personnage.
 *
 * Le texte est découpé en morceaux d'une phrase environ — les navigateurs
 * coupent les énoncés trop longs, et cela donne des repères précis pour
 * surligner et pour revenir en arrière.
 */

import { splitSentences } from './text.js';
import { settings } from './settings.js';
import { timbreById } from './casting.js';
import { loadVoices, pickVoice } from './voices.js';
import { NARRATOR_KEY } from './dialogue.js';
import * as premium from './premium.js';

const MAX_CHUNK = 220;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** Chrome (bureau) interrompt la synthèse au bout d'une quinzaine de secondes. */
const NEEDS_KEEPALIVE = typeof navigator !== 'undefined'
  && /Chrome/.test(navigator.userAgent)
  && !/Mobile|Android/.test(navigator.userAgent);

function splitLong(sentence) {
  if (sentence.length <= MAX_CHUNK) return [sentence];
  const parts = [];
  let current = '';
  for (const word of sentence.split(/\s+/)) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > MAX_CHUNK && current) {
      parts.push(current);
      current = word;
    } else {
      current = candidate;
    }
    // Une virgule est un bon endroit pour respirer.
    if (current.length > MAX_CHUNK * 0.6 && /[,;:]$/.test(current)) {
      parts.push(current);
      current = '';
    }
  }
  if (current) parts.push(current);
  return parts;
}

export function buildChunks(segments) {
  const chunks = [];
  segments.forEach((segment, segmentIndex) => {
    for (const sentence of splitSentences(segment.text)) {
      for (const text of splitLong(sentence)) {
        chunks.push({
          index: chunks.length,
          segmentIndex,
          text,
          kind: segment.kind,
          speakerKey: segment.speakerKey,
          speakerName: segment.speakerName,
        });
      }
    }
  });
  return chunks;
}

export function createPlayer(handlers = {}) {
  let chunks = [];
  let casting = {};
  let voices = [];
  let current = 0;
  let status = 'idle';
  let generation = 0;
  let paused = false;
  let resumeWaiters = [];
  let utterance = null;
  let audio = null;
  let keepalive = null;
  let premiumFailed = false;

  const emit = () => handlers.onState?.({ status, index: current, total: chunks.length });

  function setStatus(next) {
    if (status === next) return;
    status = next;
    emit();
  }

  loadVoices().then((list) => { voices = list; });

  /** Quelle voix pour ce personnage ? */
  function voiceFor(speakerKey) {
    const timbreId = casting[speakerKey] || (speakerKey === NARRATOR_KEY ? 'narrateur' : 'narrateur');
    const timbre = timbreById(timbreId);
    const preferredName = settings.get('systemVoices')?.[timbre.id] || '';
    const rotation = Math.max(0, [...Object.keys(casting)].sort().indexOf(speakerKey));
    return {
      timbre,
      voice: pickVoice(voices, timbre, { preferredName, rotation }),
      premiumVoiceId: settings.get('premiumVoices')?.[timbre.id] || '',
    };
  }

  function waitWhilePaused(mine) {
    if (!paused || mine !== generation) return Promise.resolve();
    return new Promise((resolve) => { resumeWaiters.push(resolve); });
  }

  function releaseWaiters() {
    const waiters = resumeWaiters;
    resumeWaiters = [];
    waiters.forEach((resolve) => resolve());
  }

  function stopAudio() {
    if (audio) {
      audio.pause();
      if (audio.src.startsWith('blob:')) URL.revokeObjectURL(audio.src);
      audio = null;
    }
    if (globalThis.speechSynthesis) speechSynthesis.cancel();
    utterance = null;
    clearInterval(keepalive);
    keepalive = null;
  }

  /** Lecture par la synthèse du système. Résout 'done' ou 'interrupted'. */
  function speakLocal(chunk, config) {
    return new Promise((resolve, reject) => {
      if (!globalThis.speechSynthesis) {
        reject(new Error("Ce navigateur ne sait pas lire à voix haute."));
        return;
      }
      speechSynthesis.cancel();
      const spoken = new SpeechSynthesisUtterance(chunk.text);
      spoken.lang = config.voice?.lang || 'fr-FR';
      if (config.voice) spoken.voice = config.voice;
      spoken.pitch = clamp(config.timbre.pitch, 0, 2);
      spoken.rate = clamp(config.timbre.rate * (settings.get('rate') || 1), 0.1, 10);
      spoken.onboundary = (event) => {
        if (event.charIndex === undefined) return;
        handlers.onWord?.(event.charIndex, event.charLength || 0);
      };
      spoken.onend = () => resolve('done');
      spoken.onerror = (event) => {
        if (event.error === 'interrupted' || event.error === 'canceled') resolve('interrupted');
        else reject(new Error(`La synthèse vocale a échoué (${event.error}).`));
      };
      utterance = spoken;
      speechSynthesis.speak(spoken);

      if (NEEDS_KEEPALIVE) {
        clearInterval(keepalive);
        keepalive = setInterval(() => {
          if (!paused && speechSynthesis.speaking) { speechSynthesis.pause(); speechSynthesis.resume(); }
        }, 9000);
      }
    });
  }

  /** Lecture par une voix premium, avec surlignage estimé sur la durée. */
  async function speakPremium(chunk, config, mine) {
    handlers.onBuffering?.(true);
    let blob;
    try {
      blob = await premium.synthesize(chunk.text, { voiceId: config.premiumVoiceId });
    } finally {
      handlers.onBuffering?.(false);
    }
    if (mine !== generation) return 'interrupted';

    return new Promise((resolve, reject) => {
      const element = new Audio(URL.createObjectURL(blob));
      element.playbackRate = clamp(config.timbre.rate * (settings.get('rate') || 1), 0.5, 2);
      audio = element;

      let frame = 0;
      const follow = () => {
        if (audio !== element || !element.duration) return;
        const ratio = element.currentTime / element.duration;
        handlers.onWord?.(Math.floor(ratio * chunk.text.length), 0);
        frame = requestAnimationFrame(follow);
      };
      element.onplay = () => { frame = requestAnimationFrame(follow); };
      element.onended = () => { cancelAnimationFrame(frame); resolve('done'); };
      element.onerror = () => { cancelAnimationFrame(frame); reject(new Error("L'extrait audio n'a pas pu être joué.")); };
      element.play().catch(() => resolve('interrupted'));
    });
  }

  /**
   * Prépare à l'avance les extraits suivants. Sans cela, chaque phrase marque
   * un temps d'arrêt le temps de son téléchargement. Le cache et la mise en
   * commun des requêtes garantissent qu'on ne paie jamais deux fois.
   */
  function prefetch(fromIndex) {
    if (settings.get('voiceProvider') !== 'premium' || !premium.isConfigured() || premiumFailed) return;
    for (let i = fromIndex; i < Math.min(fromIndex + 2, chunks.length); i += 1) {
      const config = voiceFor(chunks[i].speakerKey);
      if (!config.premiumVoiceId) continue;
      premium.synthesize(chunks[i].text, { voiceId: config.premiumVoiceId }).catch(() => { /* on verra à la lecture */ });
    }
  }

  async function speakChunk(chunk, mine) {
    const config = voiceFor(chunk.speakerKey);
    const wantsPremium = settings.get('voiceProvider') === 'premium'
      && premium.isConfigured()
      && config.premiumVoiceId
      && !premiumFailed;

    if (wantsPremium) {
      try {
        return await speakPremium(chunk, config, mine);
      } catch (error) {
        // Clé refusée ou quota épuisé : inutile d'insister à chaque phrase.
        if (error.fatal) premiumFailed = true;
        handlers.onWarning?.(error.fatal
          ? `${error.message} On continue avec les voix de l'appareil.`
          : error.message);
      }
    }
    return speakLocal(chunk, config);
  }

  async function run(from) {
    const mine = ++generation;
    premiumFailed = false;
    paused = false;
    setStatus('playing');

    for (let i = from; i < chunks.length;) {
      if (mine !== generation) return;
      await waitWhilePaused(mine);
      if (mine !== generation) return;

      current = i;
      emit();
      handlers.onChunk?.(i, chunks[i]);
      prefetch(i + 1);

      let outcome;
      try {
        outcome = await speakChunk(chunks[i], mine);
      } catch (error) {
        if (mine !== generation) return;
        stopAudio();
        setStatus('idle');
        handlers.onError?.(error);
        return;
      }
      if (mine !== generation) return;
      // Interrompu pour une pause : on rejouera ce même morceau au redémarrage.
      if (outcome === 'interrupted' && paused) continue;
      if (outcome === 'interrupted' && !paused) return;
      i += 1;
    }

    stopAudio();
    current = 0;
    setStatus('idle');
    handlers.onFinish?.();
  }

  return {
    load(segments, castingMap) {
      this.stop();
      chunks = buildChunks(segments);
      casting = castingMap || {};
      current = 0;
      emit();
      return chunks;
    },
    refreshVoices: async () => { voices = await loadVoices(); return voices; },
    get chunks() { return chunks; },
    get status() { return status; },
    get index() { return current; },

    play(from = current) { run(Math.max(0, Math.min(from, chunks.length - 1))); },

    pause() {
      if (status !== 'playing') return;
      paused = true;
      setStatus('paused');
      if (audio) { audio.pause(); return; }
      if (!globalThis.speechSynthesis) return;
      speechSynthesis.pause();
      // Certaines plateformes ignorent pause() : on coupe, et on rejouera le morceau.
      setTimeout(() => {
        if (paused && speechSynthesis.speaking && !speechSynthesis.paused) speechSynthesis.cancel();
      }, 250);
    },

    resume() {
      if (status !== 'paused') return;
      paused = false;
      setStatus('playing');
      if (audio) { audio.play().catch(() => {}); return; }
      if (globalThis.speechSynthesis?.paused) speechSynthesis.resume();
      releaseWaiters();
    },

    toggle() {
      if (status === 'playing') this.pause();
      else if (status === 'paused') this.resume();
      else this.play();
    },

    stop() {
      generation += 1;
      paused = false;
      releaseWaiters();
      stopAudio();
      setStatus('idle');
    },

    goTo(index) {
      const target = Math.max(0, Math.min(index, chunks.length - 1));
      const wasReading = status !== 'idle';
      this.stop();
      current = target;
      emit();
      if (wasReading) this.play(target);
      else handlers.onChunk?.(target, chunks[target]);
    },

    next() { this.goTo(current + 1); },
    previous() { this.goTo(current - 1); },
  };
}

/** Fait entendre un timbre, pour choisir en connaissance de cause. */
export async function previewTimbre(timbre, text = 'Bonjour ! Écoute un peu ma voix.') {
  if (!globalThis.speechSynthesis) return;
  const voices = await loadVoices();
  speechSynthesis.cancel();
  const spoken = new SpeechSynthesisUtterance(text);
  const voice = pickVoice(voices, timbre, { preferredName: settings.get('systemVoices')?.[timbre.id] || '' });
  if (voice) { spoken.voice = voice; spoken.lang = voice.lang; } else spoken.lang = 'fr-FR';
  spoken.pitch = clamp(timbre.pitch, 0, 2);
  spoken.rate = clamp(timbre.rate * (settings.get('rate') || 1), 0.1, 10);
  speechSynthesis.speak(spoken);
}
