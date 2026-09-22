/**
 * Vraies voix, par ElevenLabs.
 *
 * La clé est saisie par l'adulte et reste dans le stockage local du navigateur ;
 * elle n'est envoyée qu'à api.elevenlabs.io. En contrepartie de la qualité, le
 * texte des pages lues transite par ce service — c'est pourquoi le mode local
 * reste possible à tout moment.
 *
 * Deux précautions qui touchent au portefeuille :
 *   — tout extrait généré est gardé sur l'appareil (relire ne coûte rien) ;
 *   — deux demandes simultanées du même extrait partagent un seul appel.
 */

import { audioCache } from './store.js';
import { settings } from './settings.js';

const API = 'https://api.elevenlabs.io/v1';

/** Demandes en cours, pour ne jamais payer deux fois la même phrase. */
const inFlight = new Map();

export const isConfigured = () => Boolean(settings.get('premiumKey'));

function fail(message, fatal = false) {
  const error = new Error(message);
  error.fatal = fatal;                  // fatal = inutile de réessayer cette session
  return error;
}

function describeError(response) {
  if (response.status === 401 || response.status === 403) {
    return fail('Clé ElevenLabs refusée. Vérifie-la dans les réglages.', true);
  }
  if (response.status === 429) {
    return fail('Quota ElevenLabs atteint. Les voix de l’appareil prennent le relais.', true);
  }
  if (response.status === 422) return fail('ElevenLabs a refusé ce texte.', false);
  return fail(`ElevenLabs a répondu ${response.status}.`, false);
}

async function cacheKey(parts) {
  const input = parts.join('\u0000');
  if (!globalThis.crypto?.subtle) return `plain:${input.slice(0, 200)}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function headers() {
  const key = settings.get('premiumKey');
  if (!key) throw fail('Aucune clé ElevenLabs enregistrée.', true);
  return { 'xi-api-key': key };
}

/** Les voix du compte, avec leur extrait de démonstration (gratuit à écouter). */
export async function listVoices() {
  const response = await fetch(`${API}/voices`, { headers: headers() });
  if (!response.ok) throw describeError(response);
  const payload = await response.json();
  return (payload.voices || []).map((voice) => ({
    id: voice.voice_id,
    name: voice.name,
    labels: voice.labels || {},
    description: voice.description || '',
    preview: voice.preview_url || null,
  }));
}

/**
 * Les modèles disponibles sur le compte. On ne code aucun identifiant en dur :
 * le catalogue d'ElevenLabs bouge, et les offres n'ouvrent pas les mêmes modèles.
 */
export async function listModels() {
  const response = await fetch(`${API}/models`, { headers: headers() });
  if (!response.ok) throw describeError(response);
  const payload = await response.json();
  return (Array.isArray(payload) ? payload : payload.models || [])
    .filter((model) => model.can_do_text_to_speech !== false)
    .map((model) => ({
      id: model.model_id,
      name: model.name || model.model_id,
      languages: (model.languages || []).map((language) => language.language_id || language),
    }));
}

/** Vérifie la clé et renvoie ce qu'on peut en faire. */
export async function checkKey() {
  const [voices, models] = await Promise.all([listVoices(), listModels().catch(() => [])]);
  return { voices, models };
}

/** Renvoie un Blob audio pour ce texte et cette voix, depuis le cache si possible. */
export async function synthesize(text, { voiceId, stability = 0.4, similarity = 0.75, style = 0.35 } = {}) {
  if (!voiceId) throw fail("Ce personnage n'a pas encore de vraie voix associée.", false);
  const model = settings.get('premiumModel') || 'eleven_multilingual_v2';
  const id = await cacheKey([voiceId, model, String(stability), String(similarity), String(style), text]);

  const cached = await audioCache.get(id).catch(() => null);
  if (cached) return cached;
  if (inFlight.has(id)) return inFlight.get(id);

  const request = (async () => {
    const response = await fetch(`${API}/text-to-speech/${encodeURIComponent(voiceId)}`, {
      method: 'POST',
      headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        model_id: model,
        voice_settings: { stability, similarity_boost: similarity, style, use_speaker_boost: true },
      }),
    });
    if (!response.ok) throw describeError(response);
    const blob = await response.blob();
    await audioCache.put(id, blob).catch(() => { /* quota plein : on relira en ligne */ });
    return blob;
  })().finally(() => inFlight.delete(id));

  inFlight.set(id, request);
  return request;
}

/** Combien de caractères cette page coûtera-t-elle ? (facturation au caractère) */
export const countCharacters = (segments) => segments.reduce((total, segment) => total + segment.text.length, 0);

export const clearCache = () => audioCache.clear();
export const cacheSize = () => audioCache.size();
