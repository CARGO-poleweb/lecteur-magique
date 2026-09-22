/**
 * Écran de lecture : le texte en grand, le mot en cours surligné,
 * et le personnage qui parle affiché en haut.
 */

import { qs, el, clear, toast } from '../ui.js';
import { settings } from '../settings.js';
import { session } from '../state.js';
import { router } from '../router.js';
import { colorForKey } from '../palette.js';
import { timbreById } from '../casting.js';
import { createPlayer } from '../player.js';

const SPEEDS = [0.7, 0.85, 1, 1.15, 1.35];

function tokenize(text) {
  const tokens = [];
  const re = /\S+/g;
  let match;
  while ((match = re.exec(text))) tokens.push({ start: match.index, end: match.index + match[0].length, text: match[0] });
  return tokens;
}

export function createReadScreen(live) {
  const host = qs('#read-text');
  const badge = qs('#read-speaker');
  const playButton = qs('#read-play');
  const progress = qs('#read-progress');
  const speedButton = qs('#read-speed');
  const nextPageChip = qs('#read-next-page');
  let pendingPage = null;
  let currentChunkNode = null;
  let spokenWord = null;
  let wired = false;

  const player = createPlayer({
    onChunk: (index, chunk) => focusChunk(index, chunk),
    onWord: (charIndex) => highlightWord(charIndex),
    onState: ({ status, index, total }) => {
      playButton.textContent = status === 'playing' ? '⏸' : '▶️';
      playButton.setAttribute('aria-label', status === 'playing' ? 'Pause' : 'Lire');
      progress.style.width = total ? `${((index + (status === 'idle' ? 0 : 1)) / total) * 100}%` : '0%';
    },
    onBuffering: (busy) => { playButton.textContent = busy ? '…' : playButton.textContent; },
    onWarning: (message) => toast(message),
    onError: (error) => toast(error.message, 'error'),
    onFinish: () => {
      currentChunkNode?.classList.remove('is-current');
      spokenWord?.classList.remove('is-spoken');
      if (pendingPage) { applyPage(pendingPage); return; }
      toast('Page terminée 🎉 Tourne la page, je continue.', 'ok');
    },
  });

  /** Charge une page fraîchement reconnue et enchaîne la lecture. */
  async function applyPage(page) {
    pendingPage = null;
    nextPageChip.hidden = true;
    session.thumb = page.thumb;
    session.confidence = page.confidence;
    session.setText(page.text);
    try { await session.persist(); } catch { /* la lecture prime sur le rangement */ }
    render();
    player.play(0);
  }

  /** La caméra a vu une nouvelle page pendant qu'on lisait. */
  function onNewPage(page) {
    if (player.status === 'idle') { applyPage(page); return; }
    pendingPage = page;
    nextPageChip.hidden = false;
  }

  function focusChunk(index, chunk) {
    currentChunkNode?.classList.remove('is-current');
    spokenWord?.classList.remove('is-spoken');
    spokenWord = null;

    currentChunkNode = host.querySelector(`.read-chunk[data-index="${index}"]`);
    if (!currentChunkNode) return;
    currentChunkNode.classList.add('is-current');
    if (settings.get('autoScroll')) {
      currentChunkNode.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }

    const timbre = timbreById(session.casting[chunk.speakerKey]);
    const color = colorForKey(chunk.speakerKey);
    badge.style.setProperty('--speaker-color', color);
    badge.querySelector('.speaker-emoji').textContent = timbre.emoji;
    badge.querySelector('.speaker-name').textContent = chunk.kind === 'narration' ? 'Narrateur' : chunk.speakerName;
  }

  function highlightWord(charIndex) {
    if (!settings.get('highlightWords') || !currentChunkNode) return;
    let target = null;
    for (const word of currentChunkNode.querySelectorAll('.read-word')) {
      if (Number(word.dataset.start) <= charIndex) target = word;
      else break;
    }
    if (target === spokenWord) return;
    spokenWord?.classList.remove('is-spoken');
    target?.classList.add('is-spoken');
    spokenWord = target;
  }

  function render() {
    const chunks = player.load(session.segments, session.casting);
    clear(host);
    host.classList.toggle('easy-font', Boolean(settings.get('easyFont')));
    currentChunkNode = null;
    spokenWord = null;

    let paragraph = null;
    let segmentIndex = -1;
    for (const chunk of chunks) {
      if (chunk.segmentIndex !== segmentIndex) {
        segmentIndex = chunk.segmentIndex;
        paragraph = el('p', {
          class: 'read-paragraph',
          dataset: { kind: chunk.kind },
          style: `--speaker-color:${colorForKey(chunk.speakerKey)}`,
        });
        host.append(paragraph);
      }
      const span = el('span', {
        class: `read-chunk${chunk.kind === 'narration' ? ' is-narration' : ''}`,
        dataset: { index: String(chunk.index) },
        onClick: () => player.goTo(chunk.index),
      });
      let cursor = 0;
      for (const token of tokenize(chunk.text)) {
        if (token.start > cursor) span.append(document.createTextNode(chunk.text.slice(cursor, token.start)));
        span.append(el('span', { class: 'read-word', dataset: { start: String(token.start) } }, token.text));
        cursor = token.end;
      }
      if (cursor < chunk.text.length) span.append(document.createTextNode(chunk.text.slice(cursor)));
      paragraph.append(span, document.createTextNode(' '));
    }

    if (!chunks.length) {
      host.append(el('p', { class: 'empty' }, 'Rien à lire sur cette page.'));
    }
    updateSpeedLabel();
  }

  function updateSpeedLabel() {
    const rate = settings.get('rate') || 1;
    speedButton.textContent = `${rate}×`.replace('.', ',');
  }

  function wire() {
    if (wired) return;
    wired = true;
    playButton.addEventListener('click', () => player.toggle());
    qs('#read-prev').addEventListener('click', () => player.previous());
    qs('#read-next').addEventListener('click', () => player.next());
    qs('#read-back').addEventListener('click', () => router.back());
    nextPageChip.addEventListener('click', () => { if (pendingPage) applyPage(pendingPage); });
    speedButton.addEventListener('click', () => {
      const rate = settings.get('rate') || 1;
      const next = SPEEDS[(SPEEDS.indexOf(rate) + 1) % SPEEDS.length];
      settings.set('rate', next);
      updateSpeedLabel();
      if (player.status !== 'idle') player.goTo(player.index);
    });
  }

  return {
    async mount(_params, options = {}) {
      wire();
      render();                                   // le texte s'affiche tout de suite
      pendingPage = null;
      nextPageChip.hidden = true;

      // La caméra continue de veiller : c'est elle qui verra la page tournée.
      live.setHandlers({
        onPage: onNewPage,
        onError: (error) => toast(error.message, 'error'),
      });
      live.setMode(settings.get('autoPageTurn') ? 'mini' : 'off');

      const voices = await player.refreshVoices();
      if (!voices.length && settings.get('voiceProvider') !== 'premium') {
        toast("Aucune voix n'est installée sur cet appareil : le texte s'affiche, mais je ne peux pas le lire.", 'error');
        return;
      }
      // De retour depuis l'écran des voix : on ne relance pas tout seul.
      if (!options.restored) player.play(0);
    },
    unmount() { player.stop(); },
  };
}
