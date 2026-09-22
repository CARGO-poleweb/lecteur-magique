/**
 * Voix premium — OPTIONNEL, désactivé par défaut.
 *
 * Fournisseur : ElevenLabs (vraies voix de comédiens, multilingue).
 * La clé est saisie par l'adulte et reste dans le stockage local du navigateur ;
 * elle n'est envoyée qu'à api.elevenlabs.io. Le texte des pages lues transite
 * donc par ce service : c'est le prix de ces voix, et c'est pour cette raison
 * que le mode local reste celui par défaut.
 *
 * Chaque extrait généré est mis en cache sur l'appareil : relire une page déjà
 * lue ne consomme plus rien.
 */

import { audioCache } from './store.js';
import { settings } from './settings.js';

const API = 'https://api.elevenlabs.io/v1';

export const isConfigured = () => Boolean(settings.get('premiumKey'));

async function cacheKey(parts) {
  const input = parts.join('\u0000');
  if (!globalThis.crypto?.subtle) return `plain:${input.slice(0, 200)}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function describeError(response) {
  if (response.status === 401) return 'Clé ElevenLabs refusée. Vérifie-la dans les réglages.';
  if (response.status === 429) return 'Quota ElevenLabs atteint. Les voix locales prennent le relais.';
  if (response.status === 422) return "Ce texte a été refusé par ElevenLabs (trop long ?).";
  return `ElevenLabs a répondu ${response.status}.`;
}

/** Liste les voix du compte, pour les associer aux timbres. */
export async function listVoices() {
  const key = settings.get('premiumKey');
  if (!key) throw new Error('Aucune clé ElevenLabs enregistrée.');
  const response = await fetch(`${API}/voices`, { headers: { 'xi-api-key': key } });
  if (!response.ok) throw new Error(describeError(response));
  const payload = await response.json();
  return (payload.voices || []).map((voice) => ({
    id: voice.voice_id,
    name: voice.name,
    labels: voice.labels || {},
    preview: voice.preview_url || null,
  }));
}

/** Vérifie la clé sans rien synthétiser. */
export async function checkKey() {
  const voices = await listVoices();
  return voices.length;
}

/**
 * Renvoie un Blob audio pour ce texte et cette voix, depuis le cache si possible.
 */
export async function synthesize(text, { voiceId, stability = 0.4, similarity = 0.75, style = 0.35 } = {}) {
  const key = settings.get('premiumKey');
  if (!key) throw new Error('Aucune clé ElevenLabs enregistrée.');
  if (!voiceId) throw new Error("Ce personnage n'a pas encore de voix premium associée.");
  const model = settings.get('premiumModel') || 'eleven_multilingual_v2';

  const id = await cacheKey([voiceId, model, String(stability), String(similarity), String(style), text]);
  const cached = await audioCache.get(id).catch(() => null);
  if (cached) return cached;

  const response = await fetch(`${API}/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      model_id: model,
      voice_settings: { stability, similarity_boost: similarity, style, use_speaker_boost: true },
    }),
  });
  if (!response.ok) throw new Error(describeError(response));

  const blob = await response.blob();
  await audioCache.put(id, blob).catch(() => { /* quota plein : tant pis, on relira en ligne */ });
  return blob;
}

export const clearCache = () => audioCache.clear();
export const cacheSize = () => audioCache.size();
