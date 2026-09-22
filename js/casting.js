/**
 * Les « timbres » : des personnages de voix prêts à l'emploi.
 *
 * Avec les voix du système on ne peut pas changer de comédien, seulement de
 * hauteur (pitch) et de débit (rate). Bien réglés, ces deux curseurs suffisent
 * à distinguer nettement un ogre d'une petite souris — c'est le principe ici.
 * Les indices `voiceHints` permettent d'attraper les voix « personnage » que
 * proposent certains téléphones (Grand-mère, Rocko…) quand elles existent.
 */

export const TIMBRES = [
  { id: 'narrateur', name: 'Narrateur', emoji: '📖', pitch: 1.0, rate: 1.0, gender: null },
  { id: 'fillette', name: 'Petite fille', emoji: '👧', pitch: 1.75, rate: 1.06, gender: 'f' },
  { id: 'garcon', name: 'Petit garçon', emoji: '👦', pitch: 1.5, rate: 1.08, gender: 'm' },
  { id: 'maman', name: 'Maman', emoji: '👩', pitch: 1.15, rate: 1.0, gender: 'f' },
  { id: 'papa', name: 'Papa', emoji: '🧔', pitch: 0.75, rate: 0.98, gender: 'm' },
  { id: 'mamie', name: 'Mamie', emoji: '👵', pitch: 1.3, rate: 0.82, gender: 'f', voiceHints: ['grand-mère', 'grand mere', 'mamie'] },
  { id: 'papi', name: 'Papi', emoji: '👴', pitch: 0.7, rate: 0.8, gender: 'm', voiceHints: ['grand-père', 'grand pere', 'papi'] },
  { id: 'loup', name: 'Grand méchant loup', emoji: '🐺', pitch: 0.3, rate: 0.88, gender: 'm' },
  { id: 'ogre', name: 'Ogre', emoji: '👹', pitch: 0.1, rate: 0.74, gender: 'm' },
  { id: 'geant', name: 'Géant', emoji: '🗿', pitch: 0.2, rate: 0.72, gender: 'm' },
  { id: 'dragon', name: 'Dragon', emoji: '🐉', pitch: 0.15, rate: 0.8, gender: 'm' },
  { id: 'sorciere', name: 'Sorcière', emoji: '🧙', pitch: 1.65, rate: 0.92, gender: 'f' },
  { id: 'fee', name: 'Fée', emoji: '🧚', pitch: 1.95, rate: 1.12, gender: 'f' },
  { id: 'princesse', name: 'Princesse', emoji: '👑', pitch: 1.6, rate: 1.0, gender: 'f' },
  { id: 'roi', name: 'Roi', emoji: '🤴', pitch: 0.65, rate: 0.85, gender: 'm' },
  { id: 'souris', name: 'Petite souris', emoji: '🐭', pitch: 2.0, rate: 1.3, gender: 'f' },
  { id: 'oiseau', name: 'Oiseau', emoji: '🐦', pitch: 1.9, rate: 1.26, gender: null },
  { id: 'chat', name: 'Chat malin', emoji: '🐱', pitch: 1.4, rate: 1.15, gender: null },
  { id: 'chien', name: 'Gros chien', emoji: '🐶', pitch: 0.55, rate: 0.95, gender: 'm' },
  { id: 'robot', name: 'Robot', emoji: '🤖', pitch: 0.45, rate: 0.9, gender: null },
  { id: 'pirate', name: 'Pirate', emoji: '🏴‍☠️', pitch: 0.6, rate: 1.02, gender: 'm' },
  { id: 'lutin', name: 'Lutin farceur', emoji: '🧝', pitch: 1.85, rate: 1.22, gender: null },
];

export const timbreById = (id) => TIMBRES.find((timbre) => timbre.id === id) || TIMBRES[0];

/** Un personnage dont le nom parle de lui-même mérite le bon timbre d'office. */
const BY_NAME = [
  [/\b(loup|louve)\b/, 'loup'],
  [/ogre|ogresse|monstre|troll|geant|colosse/, 'ogre'],
  [/dragon|crocodile|dinosaure|serpent/, 'dragon'],
  [/sorcier|sorciere|magicien|mage/, 'sorciere'],
  [/\bfee\b|lutin|elfe|farfadet/, 'fee'],
  [/princesse|reine/, 'princesse'],
  [/\broi\b|\bprince\b|empereur|chevalier/, 'roi'],
  [/maman|\bmere\b|mamans/, 'maman'],
  [/papa|\bpere\b/, 'papa'],
  [/mamie|mamy|grand-?\s?mere|\bmeme\b/, 'mamie'],
  [/papi|papy|grand-?\s?pere|\bpepe\b/, 'papi'],
  [/souris|\brat\b|mulot|lapin|lapine|ecureuil|poussin/, 'souris'],
  [/oiseau|moineau|corbeau|hibou|poule|canard|\bcoq\b|pie\b|merle/, 'oiseau'],
  [/\bchat\b|chatte|minou|chaton/, 'chat'],
  [/chien|toutou|chiot|molosse/, 'chien'],
  [/robot|machine|ordinateur/, 'robot'],
  [/pirate|capitaine|corsaire|marin/, 'pirate'],
  [/\bours\b|sanglier|taureau|elephant|bucheron|\bgeant\b/, 'geant'],
  [/fillette|\bfille\b|\bsoeur\b/, 'fillette'],
  [/\bgarcon\b|\bfrere\b|\bfils\b/, 'garcon'],
  [/\bbebe\b|poussin/, 'souris'],
];

const POOLS = {
  f: ['fillette', 'maman', 'princesse', 'sorciere', 'mamie', 'fee', 'souris'],
  m: ['garcon', 'papa', 'pirate', 'roi', 'papi', 'chien', 'loup'],
  null: ['chat', 'lutin', 'oiseau', 'robot', 'garcon', 'fillette', 'pirate', 'maman'],
};

/**
 * Attribue un timbre à chaque personnage : d'abord par son nom, sinon par son
 * genre, en évitant de donner deux fois la même voix.
 */
export function autoCast(characters, existing = {}) {
  const casting = { ...existing };
  const used = new Set(Object.values(casting));

  const take = (candidates) => candidates.find((id) => !used.has(id)) || candidates[0];

  for (const character of characters) {
    if (casting[character.key]) continue;
    const key = character.key;

    const named = BY_NAME.find(([pattern]) => pattern.test(key));
    let chosen = named && !used.has(named[1]) ? named[1] : null;
    if (!chosen) chosen = take(POOLS[character.gender ?? 'null'] || POOLS.null);
    if (!chosen) chosen = take(TIMBRES.map((timbre) => timbre.id).filter((id) => id !== 'narrateur'));

    casting[key] = chosen;
    used.add(chosen);
  }
  return casting;
}

/* ------------------------------------------------------------------ *
 *  Association des timbres aux voix d'un compte ElevenLabs.
 *  Les voix arrivent étiquetées (genre, âge, description, usage) : on
 *  s'en sert pour proposer une distribution tenable sans rien écouter.
 * ------------------------------------------------------------------ */

/** Ce que chaque timbre cherche chez une voix. */
const PREMIUM_WISHES = {
  narrateur: { use: /narrat|story/i, bonus: /calm|warm|pleasant|smooth/i },
  fillette: { gender: 'female', age: /young/i, bonus: /child|girl|bright|cheer/i },
  garcon: { gender: 'male', age: /young/i, bonus: /child|boy|bright/i },
  maman: { gender: 'female', age: /middle/i, bonus: /warm|soft|gentle/i },
  papa: { gender: 'male', age: /middle/i, bonus: /warm|calm/i },
  mamie: { gender: 'female', age: /old/i, bonus: /grand|warm/i },
  papi: { gender: 'male', age: /old/i, bonus: /grand|warm/i },
  loup: { gender: 'male', bonus: /deep|gruff|raspy|hoarse|husky|dark/i },
  ogre: { gender: 'male', bonus: /deep|gruff|booming|monster|dark/i },
  geant: { gender: 'male', bonus: /deep|booming|powerful/i },
  dragon: { gender: 'male', bonus: /deep|raspy|dark|intense/i },
  sorciere: { gender: 'female', age: /old/i, bonus: /raspy|witch|crackl|sharp|villain/i },
  fee: { gender: 'female', age: /young/i, bonus: /soft|light|whisper|sweet/i },
  princesse: { gender: 'female', age: /young/i, bonus: /sweet|gentle|elegant/i },
  roi: { gender: 'male', bonus: /authorit|deep|noble|command/i },
  souris: { gender: 'female', age: /young/i, bonus: /light|small|squeak|high/i },
  oiseau: { bonus: /light|bright|high/i },
  chat: { bonus: /playful|sly|smooth/i },
  chien: { gender: 'male', bonus: /deep|friendly/i },
  robot: { bonus: /flat|monoton|robot|neutral/i },
  pirate: { gender: 'male', bonus: /raspy|rough|gruff|character/i },
  lutin: { bonus: /playful|mischie|light|quirky/i },
};

/** Tout ce qu'une voix raconte sur elle-même, en une chaîne. */
const voiceText = (voice) => [
  voice.name,
  voice.description,
  ...Object.values(voice.labels || {}),
].filter(Boolean).join(' ');

function scoreVoice(wish, voice) {
  const labels = voice.labels || {};
  const text = voiceText(voice);
  let score = 0;
  if (wish.gender) score += labels.gender === wish.gender ? 3 : -2;
  if (wish.age) score += wish.age.test(labels.age || '') ? 2 : 0;
  if (wish.use) score += wish.use.test(`${labels.use_case || ''} ${text}`) ? 2 : 0;
  if (wish.bonus) score += wish.bonus.test(text) ? 3 : 0;
  // À qualité égale, une voix française évite un accent anglais sur du français.
  if (/french|fran\u00e7ais/i.test(text)) score += 2;
  return score;
}

/**
 * Propose une voix ElevenLabs par timbre, sans donner deux fois la même tant
 * qu'il en reste. `existing` est conservé : on ne défait pas un choix manuel.
 */
export function suggestPremiumVoices(voices, existing = {}, timbreIds = TIMBRES.map((t) => t.id)) {
  const chosen = { ...existing };
  const used = new Set(Object.values(chosen).filter(Boolean));
  if (!voices.length) return chosen;

  for (const id of timbreIds) {
    if (chosen[id]) continue;
    const wish = PREMIUM_WISHES[id] || {};
    const ranked = voices
      .map((voice) => ({ voice, score: scoreVoice(wish, voice) }))
      .sort((a, b) => b.score - a.score);
    const free = ranked.find((entry) => !used.has(entry.voice.id)) || ranked[0];
    if (!free) continue;
    chosen[id] = free.voice.id;
    used.add(free.voice.id);
  }
  return chosen;
}
