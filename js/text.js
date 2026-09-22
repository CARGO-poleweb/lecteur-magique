/**
 * Nettoyage du texte brut sorti de l'OCR.
 *
 * L'OCR d'une page de livre photographiée renvoie des lignes, pas des
 * paragraphes : chaque retour à la ligne de la mise en page devient un « \n ».
 * Ce module recolle les lignes en paragraphes, répare les césures, jette les
 * numéros de page et normalise la ponctuation française.
 */

const ZERO_WIDTH = /[­​-‍﻿]/g;

/** Réparations caractère par caractère, appliquées dans l'ordre. */
const GLYPH_FIXES = [
  [/\r\n?/g, '\n'],
  [ZERO_WIDTH, ''],
  [/ | | /g, ' '],
  [/ﬁ/g, 'fi'], [/ﬂ/g, 'fl'], [/ﬀ/g, 'ff'],
  [/ﬃ/g, 'ffi'], [/ﬄ/g, 'ffl'],
  [/<</g, '«'], [/>>/g, '»'],
  [/[“”„]/g, '"'],
  [/[‘’´`']/g, '’'],
  [/[–—―−]/g, '—'],
  [/--+/g, '—'],
  [/\.{3,}/g, '…'],
  // Confusions fréquentes de l'OCR au milieu d'un mot.
  [/([a-zà-öø-ÿ])[|](?=[a-zà-öø-ÿ])/g, '$1l'],
  [/œ/g, 'œ'],
];

/** Espaces autour de la ponctuation, à la française. */
function fixPunctuationSpacing(text) {
  return text
    .replace(/[ \t]+/g, ' ')
    .replace(/\s+([,.])/g, '$1')
    .replace(/\s*([;:!?»])/g, ' $1')
    .replace(/(«)\s*/g, '$1 ')
    .replace(/([(\[])\s+/g, '$1')
    .replace(/\s+([)\]])/g, '$1')
    .replace(/ +/g, ' ');
}

/** Une ligne qui n'apporte rien : numéro de page, trait de séparation, bruit. */
function isJunkLine(line) {
  const s = line.trim();
  if (!s) return false;
  if (/^[-—•*.,'’"«»_~\s]+$/.test(s)) return true;
  if (/^\d{1,4}$/.test(s)) return true;
  if (/^[-—\s.]*\d{1,4}[-—\s.]*$/.test(s)) return true;
  if (/^[IVXLC]{1,7}$/.test(s)) return true;
  const letters = (s.match(/[A-Za-zÀ-ÖØ-öø-ÿ]/g) || []).length;
  if (s.length <= 3 && letters <= 1) return true;
  if (s.length < 16 && letters / s.length < 0.35) return true;
  return false;
}

/** La ligne ouvre-t-elle une réplique ? (tiret cadratin ou guillemet français) */
export function startsDialogue(line) {
  return /^\s*(?:—\s|-\s|«)/.test(line);
}

function endsSentence(line) {
  return /[.!?…]["»’)]?$/.test(line.trim());
}

/**
 * Transforme le texte brut de l'OCR en paragraphes lisibles.
 * Les paragraphes sont séparés par une ligne vide.
 */
export function cleanOcrText(raw) {
  if (!raw) return '';
  let text = String(raw);
  for (const [pattern, replacement] of GLYPH_FIXES) text = text.replace(pattern, replacement);

  const lines = [];
  for (const rawLine of text.split('\n')) {
    const line = fixPunctuationSpacing(rawLine).trim();
    if (!line) { lines.push(null); continue; }
    if (isJunkLine(line)) continue;
    lines.push(line);
  }

  // Longueur médiane : sert à repérer les lignes courtes, qui finissent un paragraphe.
  const lengths = lines.filter(Boolean).map((l) => l.length).sort((a, b) => a - b);
  const median = lengths.length ? lengths[Math.floor(lengths.length / 2)] : 60;

  const paragraphs = [];
  let current = '';
  const flush = () => {
    const done = current.trim();
    if (done) paragraphs.push(done);
    current = '';
  };

  // L'OCR sépare ses blocs par une ligne vide, parfois au milieu d'une phrase :
  // on ne coupe donc sur une ligne vide que si la phrase précédente est finie.
  let pendingBreak = false;

  for (const line of lines) {
    if (line === null) { pendingBreak = true; continue; }
    if (!current) { current = line; pendingBreak = false; continue; }

    if (startsDialogue(line)) { flush(); current = line; pendingBreak = false; continue; }

    if (pendingBreak) {
      const continues = !endsSentence(current) && /^[a-zà-öø-ÿ]/.test(line);
      pendingBreak = false;
      if (!continues) { flush(); current = line; continue; }
    }

    if (/[-‐]$/.test(current) && /^[a-zà-öø-ÿ]/.test(line)) {
      current = current.slice(0, -1) + line;   // césure recollée
      continue;
    }
    if (endsSentence(current) && current.length < median * 0.78) { flush(); current = line; continue; }
    current += ' ' + line;
  }
  flush();

  return paragraphs.join('\n\n');
}

/** Les paragraphes d'un texte déjà nettoyé. */
export function toParagraphs(text) {
  return String(text || '')
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean);
}

const ABBREVIATIONS = /(?:^|\s)(?:M|MM|Mme|Mlle|Dr|St|Ste|etc|cf|ex|env|réf|vol|fig|p|pp|n°)\.$/i;

/**
 * Découpe en phrases. Sert au lecteur : une phrase = un « morceau » envoyé à la
 * synthèse vocale (les navigateurs coupent les énoncés trop longs).
 */
export function splitSentences(text) {
  const src = String(text || '').trim();
  if (!src) return [];
  const out = [];
  const re = /[.!?…]+/g;
  let start = 0;
  let match;
  while ((match = re.exec(src))) {
    let end = match.index + match[0].length;
    // Absorbe les fermantes, y compris « ! » suivi d'une espace puis du guillemet.
    for (;;) {
      if (end < src.length && /["»’)\]]/.test(src[end])) { end += 1; continue; }
      if (end + 1 < src.length && src[end] === ' ' && /["»)\]]/.test(src[end + 1])) { end += 2; continue; }
      break;
    }
    const before = src.slice(start, end);
    const after = src.slice(end);
    if (after && !/^\s/.test(after)) continue;
    if (ABBREVIATIONS.test(before.trimEnd())) continue;
    // Minuscule après le point : c'était une abréviation ou un « … » en incise.
    if (/^\s+[a-zà-öø-ÿ]/.test(after) && !/^\s*[—«"]/.test(after)) continue;
    const chunk = before.trim();
    if (chunk) out.push(chunk);
    start = end;
  }
  const tail = src.slice(start).trim();
  if (tail) out.push(tail);
  return out.length ? out : [src];
}

/** L'OCR n'a manifestement rien trouvé d'exploitable. */
export function looksEmpty(text) {
  const letters = (String(text || '').match(/[A-Za-zÀ-ÖØ-öø-ÿ]/g) || []).length;
  return letters < 12;
}

/**
 * Ressemblance entre deux textes, de 0 à 1 (indice de Jaccard sur les mots).
 * Sert à savoir si la caméra regarde toujours la même page : l'OCR ne rend
 * jamais deux fois exactement le même texte, même sans bouger.
 */
export function textSimilarity(first, second) {
  const words = (value) => new Set(String(value || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .match(/[a-z0-9]{2,}/g) || []);
  const a = words(first);
  const b = words(second);
  if (!a.size && !b.size) return 1;
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const word of a) if (b.has(word)) shared += 1;
  return shared / (a.size + b.size - shared);
}
