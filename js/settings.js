/** Réglages de l'app, conservés sur l'appareil. */

const KEY = 'lecteur-magique:settings';

const DEFAULTS = {
  rate: 1,                  // multiplicateur global de vitesse
  enhanceImage: true,       // pré-traitement de la photo avant l'OCR
  highlightWords: true,     // surligner le mot en cours
  easyFont: false,          // interlignage et espacement renforcés
  autoScroll: true,
  autoPageTurn: true,       // continuer à surveiller la caméra pendant la lecture
  voiceProvider: 'local',   // 'local' | 'premium'
  premiumKey: '',           // clé ElevenLabs, jamais envoyée ailleurs qu'à ElevenLabs
  premiumModel: 'eleven_multilingual_v2',
  premiumVoices: {},        // identifiant de timbre → voice_id ElevenLabs
  systemVoices: {},         // identifiant de timbre → nom de voix système préférée
};

function read() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

let current = read();
const listeners = new Set();

export const settings = {
  get all() { return current; },
  get(name) { return current[name]; },
  set(name, value) {
    current = { ...current, [name]: value };
    try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* mode privé */ }
    listeners.forEach((listener) => listener(current));
  },
  update(patch) {
    Object.entries(patch).forEach(([name, value]) => { current[name] = value; });
    try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* mode privé */ }
    listeners.forEach((listener) => listener(current));
  },
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  reset() {
    current = { ...DEFAULTS };
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
    listeners.forEach((listener) => listener(current));
  },
};
