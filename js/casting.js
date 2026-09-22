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
