/** Les voix installées sur l'appareil, et le choix de la meilleure pour un timbre. */

const FEMALE_HINTS = /(amélie|amelie|aurélie|aurelie|audrey|marie|virginie|chantal|julie|céline|celine|hortense|denise|léa|lea|clara|sandy|shelley|flo|grand-mère|femme|female|woman)/i;
const MALE_HINTS = /(thomas|nicolas|daniel|paul|henri|mathieu|rémi|remi|jacques|claude|rocko|grand-père|homme|male|man)/i;
const QUALITY_HINTS = /(enhanced|premium|neural|amélioré|ameliore|natural|wavenet|siri)/i;

/** Les voix arrivent parfois de façon asynchrone : on attend qu'elles soient là. */
export function loadVoices(timeout = 2500) {
  return new Promise((resolve) => {
    if (!globalThis.speechSynthesis) { resolve([]); return; }
    const existing = speechSynthesis.getVoices();
    if (existing.length) { resolve(existing); return; }

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      speechSynthesis.removeEventListener('voiceschanged', finish);
      resolve(speechSynthesis.getVoices());
    };
    speechSynthesis.addEventListener('voiceschanged', finish);
    setTimeout(finish, timeout);
  });
}

export const frenchVoices = (voices) => voices.filter((voice) => /^fr/i.test(voice.lang));

export function voiceGender(voice) {
  if (FEMALE_HINTS.test(voice.name)) return 'f';
  if (MALE_HINTS.test(voice.name)) return 'm';
  return null;
}

const score = (voice) => (QUALITY_HINTS.test(voice.name) ? 2 : 0) + (voice.localService ? 1 : 0);

/**
 * Choisit une voix système pour un timbre donné.
 * `rotation` sert à ne pas donner la même voix de base à tous les personnages
 * du même genre quand l'appareil en propose plusieurs.
 */
export function pickVoice(voices, timbre, { preferredName = '', rotation = 0 } = {}) {
  const french = frenchVoices(voices);
  const pool = french.length ? french : voices;
  if (!pool.length) return null;

  if (preferredName) {
    const exact = pool.find((voice) => voice.name === preferredName);
    if (exact) return exact;
  }

  for (const hint of timbre.voiceHints || []) {
    const match = pool.find((voice) => voice.name.toLowerCase().includes(hint));
    if (match) return match;
  }

  const ranked = [...pool].sort((a, b) => score(b) - score(a));
  if (timbre.gender) {
    const matching = ranked.filter((voice) => voiceGender(voice) === timbre.gender);
    if (matching.length) return matching[rotation % matching.length];
  }
  return ranked[rotation % ranked.length];
}

/** Résumé lisible pour l'écran des réglages. */
export function describeVoices(voices) {
  const french = frenchVoices(voices);
  if (!french.length) return "Aucune voix française installée sur cet appareil.";
  const genders = new Set(french.map(voiceGender).filter(Boolean));
  const variety = genders.size > 1 ? 'voix masculines et féminines' : 'une seule famille de voix';
  return `${french.length} voix française${french.length > 1 ? 's' : ''} disponible${french.length > 1 ? 's' : ''} (${variety}).`;
}
