/**
 * Découpage d'un texte en répliques, et attribution des personnages.
 *
 * Le but n'est pas la perfection linguistique : c'est de deviner « qui parle »
 * assez souvent pour qu'une page de livre jeunesse sonne juste, et de laisser
 * l'adulte corriger le reste d'un tapotement.
 *
 * Trois sources d'information, dans cet ordre :
 *   1. l'incise explicite            — « Bonjour, dit le loup. »
 *   2. le pronom de l'incise         — « Bonjour, dit-il. »
 *   3. l'alternance des répliques    — deux tirets qui se répondent
 */

import { toParagraphs } from './text.js';

export const NARRATOR_KEY = '__narrateur__';
export const NARRATOR_NAME = 'Narrateur';

const LOW = 'a-z\\u00E0-\\u00F6\\u00F8-\\u00FF';
const UPP = 'A-Z\\u00C0-\\u00D6\\u00D8-\\u00DE';

/** Verbes qui signalent une prise de parole. Formes 3ᵉ personne uniquement :
 *  « je dis » ou « tu répondras » n'annoncent pas une incise. */
const SPEECH_VERBS = [
  'ajouta', 'ajoute', 'affirma', 'affirme', 'appela', 'appelle', 'avoua', 'avoue', 'aboya',
  'acquiesça', 'bafouilla', 'balbutia', 'beugla', 'bredouilla', 'chuchota', 'chuchote',
  'chantonna', 'conclut', 'constata', 'corrigea', 'couina', 'cria', 'crie', 'criait',
  'déclara', 'déclare', 'demanda', 'demande', 'demandait', 'dit', 'disait',
  'enchâîna', 'enchâina', 'enchaina', 'enchâîne', 'expliqua', 'explique',
  's’écria', 's’écrie', 's’écriait', 's’exclama', 's’exclame',
  's’emporta', 's’étonna', 's’étonne', 's’inquiéta',
  's’inquiète', 's’enquit', 's’impatienta', 'fit', 'gémit', 'glapit',
  'glissa', 'gloussa', 'grogna', 'grogne', 'grommela', 'gronda', 'hurla', 'hurle', 'insista',
  'interrogea', 'jubila', 'lâcha', 'lança', 'maugréa', 'marmonna', 'marmonne',
  'miaula', 'murmura', 'murmure', 'observa', 'opina', 'ordonna', 'pépia', 'poursuivit',
  'précisa', 'promit', 'proposa', 'propose', 'protesta', 'proteste', 'prévint',
  'questionna', 'rassura', 'remarqua', 'renchérit', 'reprit', 'reprend', 'rétorqua',
  'répéta', 'répète', 'répondit', 'répond', 'répondait',
  'ricana', 'riposta', 'ronchonna', 'sanglota', 'siffla', 'songea', 'souffla', 'soupira',
  'soupire', 'suggéra', 'suggère', 'supplia', 'susurra', 'tonna', 'trancha',
  'pleurnicha', 'gazouilla', 'rugit', 'rugissait',
];

const DETERMINERS = ['le', 'la', 'les', 'un', 'une', 'mon', 'ma', 'mes', 'son', 'sa', 'ses',
  'leur', 'leurs', 'ce', 'cet', 'cette', 'notre', 'nos', 'votre', 'vos'];

const ADJECTIVES = ['petit', 'petite', 'petits', 'petites', 'grand', 'grande', 'gros', 'grosse',
  'vieux', 'vieille', 'jeune', 'joli', 'jolie', 'méchant', 'méchante', 'pauvre', 'brave',
  'gentil', 'gentille', 'vilain', 'vilaine', 'autre', 'premier', 'première', 'second',
  'seconde', 'cher', 'chère', 'sale'];

const FAMILY = ['maman', 'papa', 'mamie', 'mamy', 'papi', 'papy', 'mémé', 'pépé',
  'bébé', 'tonton', 'tata', 'grand-mère', 'grand-père'];

/** Mots qui ressemblent à un nom propre en début de phrase, mais n'en sont pas. */
const NOT_A_NAME = new Set(['il', 'elle', 'ils', 'elles', 'on', 'je', 'tu', 'nous', 'vous', 'ce',
  'cela', 'ca', 'alors', 'puis', 'enfin', 'soudain', 'mais', 'et', 'or', 'ainsi', 'quand',
  'lorsque', 'apres', 'avant', 'pendant', 'depuis', 'aussitot', 'bientot', 'jamais', 'toujours',
  'deja', 'voila', 'cependant', 'pourtant', 'donc', 'car', 'puisque', 'comme', 'si', 'des',
  'sans', 'avec', 'dans', 'sur', 'sous', 'pour', 'par', 'chez', 'vers', 'entre', 'non', 'oui',
  'bon', 'eh', 'ah', 'oh', 'ho', 'he', 'tout', 'tous', 'toute', 'toutes', 'rien', 'plus',
  'moins', 'tres', 'bien', 'mal', 'encore', 'jadis', 'maintenant', 'ensuite', 'pourquoi',
  'comment', 'combien', 'peut', 'certes', 'oui-oui']);

/** Noms communs qui suivent parfois un verbe de parole sans désigner personne. */
const NOT_A_CHARACTER = new Set(['verite', 'betise', 'betises', 'chose', 'choses', 'mot', 'mots',
  'phrase', 'phrases', 'histoire', 'histoires', 'secret', 'secrets', 'bonjour', 'bonsoir',
  'merci', 'adieu', 'nom', 'suite', 'fin', 'debut', 'matin', 'soir', 'jour', 'nuit', 'fois',
  'coup', 'air', 'ton', 'tete', 'main', 'porte', 'maison', 'chemin', 'route', 'temps', 'moment',
  'raison', 'tort', 'peur', 'faim', 'soif', 'sommeil', 'contraire', 'meme', 'priere']);

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** « loup » → « [Ll]oup » : le mot peut apparaître en début de phrase. */
function bothCases(word) {
  const first = word[0];
  const upper = first.toUpperCase();
  const lower = first.toLowerCase();
  const head = upper === lower ? escapeRe(first) : `[${escapeRe(upper)}${escapeRe(lower)}]`;
  return head + escapeRe(word.slice(1));
}

const alternation = (words) => words.slice().sort((a, b) => b.length - a.length).map(bothCases).join('|');

const VERB_SRC = alternation(SPEECH_VERBS);
// Le déterminant absorbe son espace, sauf « l’ » qui colle au nom.
const DET_SRC = `(?:(?:${alternation(DETERMINERS)})\\s+|[Ll]’)`;
const ADJ_SRC = `(?:${alternation(ADJECTIVES)})\\s+`;
const NOUN_SRC = `[${LOW}${UPP}][${LOW}’-]{1,20}`;
const COMMON_SRC = `${DET_SRC}(?:${ADJ_SRC})?${NOUN_SRC}`;
const FAMILY_SRC = `(?:${alternation(FAMILY)})`;
const PROPER_SRC = `[${UPP}][${LOW}’-]+(?:\\s+[${UPP}][${LOW}’-]+)?`;
// L'ordre compte : « Le loup » doit être lu comme un nom commun, pas comme un prénom.
const SPEAKER_SRC = `(?:${COMMON_SRC}|${FAMILY_SRC}|${PROPER_SRC})`;

const newVerbRe = () => new RegExp(`\\b(?:${VERB_SRC})\\b`, 'g');
const PRONOUN_RE = /^\s*-\s*(?:t-)?(il|elle|ils|elles|on)\b/i;
const RIGHT_SPEAKER_RE = new RegExp(`^\\s+(${SPEAKER_SRC})`);
const LEFT_SPEAKER_RE = new RegExp(`(${SPEAKER_SRC})\\s*$`);

const DELIMITERS = /[,.;:!?…—]/;
// Ponctuation qui ferme une incise : elle reste avec l'incise, pas avec la réplique qui reprend.
const INCISE_CLOSERS = /[,;:.!?…]/;

/** Clé de regroupement : sans accents, sans déterminant, sans casse. */
export function characterKey(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/’/g, "'")
    .replace(/^(?:le|la|les|un|une|mon|ma|mes|son|sa|ses|leur|leurs|ce|cet|cette|notre|nos|votre|vos)\s+/, '')
    .replace(/^l'/, '')
    .replace(/[^a-z0-9' -]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const ADJ_PREFIX_RE = new RegExp(`^(?:${ADJECTIVES.map((a) => a.normalize('NFD').replace(/[̀-ͯ]/g, '')).join('|')})\\s+`);

function tidyName(raw) {
  const name = String(raw).replace(/\s+/g, ' ').trim().replace(/[.,;:!?]+$/, '');
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function isRejectedName(raw) {
  const key = characterKey(raw);
  if (!key) return true;
  if (NOT_A_NAME.has(key)) return true;
  if (NOT_A_CHARACTER.has(key.replace(ADJ_PREFIX_RE, ''))) return true;
  return false;
}

/**
 * Cherche « qui parle » dans une proposition (une incise, ou la partie
 * narrative d'un paragraphe). Renvoie {name} ou {pronoun}, ou null.
 */
export function findAttribution(clause) {
  const text = String(clause || '');
  const re = newVerbRe();
  let match;
  while ((match = re.exec(text))) {
    const after = text.slice(match.index + match[0].length);
    const before = text.slice(0, match.index);

    const right = after.match(RIGHT_SPEAKER_RE);
    if (right && !isRejectedName(right[1])) return { name: tidyName(right[1]), verb: match[0] };

    const left = before.match(LEFT_SPEAKER_RE);
    if (left && !isRejectedName(left[1])) return { name: tidyName(left[1]), verb: match[0] };

    const pronoun = after.match(PRONOUN_RE);
    if (pronoun) return { pronoun: pronoun[1].toLowerCase(), verb: match[0] };
  }
  return null;
}

/** Ces verbes prolongent la parole de celui qui vient de parler. */
const CONTINUATION_VERBS = new Set(['ajouta', 'ajoute', 'reprit', 'reprend', 'poursuivit',
  'conclut', 'renchérit', 'précisa', 'insista', 'répéta', 'répète', 'continua', 'termina']);

const FEMININE = new Set(['maman', 'mamie', 'mamy', 'meme', 'mere', 'grand-mere', 'soeur', 'fille',
  'fillette', 'princesse', 'reine', 'fee', 'sorciere', 'dame', 'madame', 'tante', 'tata', 'chatte',
  'souris', 'poule', 'vache', 'chevre', 'biche', 'lapine', 'ourse', 'maitresse', 'institutrice',
  'marraine', 'sirene', 'ogresse', 'louve', 'grenouille', 'tortue', 'coccinelle', 'abeille']);

const MASCULINE = new Set(['papa', 'papi', 'papy', 'pepe', 'pere', 'grand-pere', 'frere', 'fils',
  'garcon', 'prince', 'roi', 'ogre', 'loup', 'dragon', 'geant', 'monsieur', 'oncle', 'tonton',
  'chat', 'chien', 'ours', 'lion', 'renard', 'cochon', 'coq', 'canard', 'pirate', 'sorcier',
  'magicien', 'parrain', 'bonhomme', 'crocodile', 'dinosaure', 'robot', 'lapin', 'elephant',
  'singe', 'hibou', 'corbeau', 'poisson', 'chevalier', 'bucheron']);

function guessGender(displayName, key) {
  const bare = key.replace(ADJ_PREFIX_RE, '');
  if (FEMININE.has(bare)) return 'f';
  if (MASCULINE.has(bare)) return 'm';
  const lead = String(displayName).toLowerCase();
  if (/^(?:la\s|l’|une\s|sa\s|cette\s|ma\s)/.test(lead)) return 'f';
  if (/^(?:le\s|un\s|son\s|ce\s|cet\s|mon\s)/.test(lead)) return 'm';
  return null;
}

/** Marque chaque caractère du paragraphe : 'd' = parlé, 'n' = narration. */
function markParagraph(para) {
  const size = para.length;
  const marks = new Array(size).fill('n');
  const attributions = [];
  let quoted = false;

  for (let i = 0; i < size;) {
    if (para[i] === '«') {
      const close = para.indexOf('»', i + 1);
      const end = close === -1 ? size : close + 1;
      for (let k = i; k < end; k += 1) marks[k] = 'd';
      quoted = true;
      i = end;
    } else i += 1;
  }

  if (!quoted) {
    const straight = [];
    for (let k = 0; k < size; k += 1) if (para[k] === '"') straight.push(k);
    for (let p = 0; p + 1 < straight.length; p += 2) {
      for (let k = straight[p]; k <= straight[p + 1]; k += 1) marks[k] = 'd';
      quoted = true;
    }
  }

  if (!quoted) {
    const dash = para.match(/^\s*(?:—|-)\s+/);
    if (dash) {
      for (let k = dash[0].length; k < size; k += 1) marks[k] = 'd';
      markIncises(para, marks, dash[0].length, size, attributions);
    }
  }

  return { marks, attributions };
}

/**
 * Dans une réplique au tiret, retrouve les incises (« …, dit le loup, … »).
 * Un verbe de parole ne suffit pas : on n'ouvre une incise que si elle nomme
 * bien quelqu'un, sinon « — Il dit toujours ça ! » basculerait en narration.
 */
function markIncises(para, marks, from, to, attributions) {
  const region = para.slice(from, to);
  const re = newVerbRe();
  let match;
  while ((match = re.exec(region))) {
    const verbStart = from + match.index;
    const verbEnd = verbStart + match[0].length;

    let left = verbStart;
    while (left > from && !DELIMITERS.test(para[left - 1])) left -= 1;
    let right = verbEnd;
    while (right < to && !DELIMITERS.test(para[right])) right += 1;
    if (right < to && INCISE_CLOSERS.test(para[right])) right += 1;

    const clause = para.slice(left, right);
    const attribution = findAttribution(clause);
    if (!attribution) continue;

    for (let k = left; k < right; k += 1) marks[k] = 'n';
    attributions.push(attribution);
  }
}

function runsFromMarks(para, marks) {
  const runs = [];
  let start = 0;
  for (let i = 1; i <= para.length; i += 1) {
    if (i === para.length || marks[i] !== marks[i - 1]) {
      runs.push({ kind: marks[start] === 'd' ? 'dialogue' : 'narration', text: para.slice(start, i) });
      start = i;
    }
  }
  return runs;
}

const hasLetters = (s) => /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(s);

function cleanRun(run) {
  let text = run.text;
  if (run.kind === 'dialogue') {
    text = text.replace(/^[\s—"«-]+/, '').replace(/[\s"»]+$/, '');
  } else {
    text = text.replace(/^[\s—,;-]+/, '').replace(/\s+$/, '');
  }
  return text.trim();
}

/** Registre des personnages rencontrés, avec fusion des variantes. */
function createRegistry() {
  const characters = new Map();

  function resolveKey(name) {
    const key = characterKey(name);
    if (!key || characters.has(key)) return key;
    const bare = key.replace(ADJ_PREFIX_RE, '');
    if (bare !== key && characters.has(bare)) return bare;          // « le petit lapin » → « lapin »
    for (const existing of characters.keys()) {
      if (existing.replace(ADJ_PREFIX_RE, '') === key) return existing;
    }
    return key;
  }

  return {
    characters,
    register(name) {
      const key = resolveKey(name);
      if (!key) return null;
      const display = tidyName(name);
      let entry = characters.get(key);
      if (!entry) {
        entry = { key, name: display, gender: guessGender(display, key), count: 0, placeholder: false };
        characters.set(key, entry);
      }
      // Un nom propre est plus parlant qu'un « le petit » générique.
      if (entry.placeholder) { entry.name = display; entry.placeholder = false; }
      if (!entry.gender) entry.gender = guessGender(display, key);
      return entry;
    },
    placeholder(index) {
      const key = `__voix_${index}__`;
      let entry = characters.get(key);
      if (!entry) {
        entry = { key, name: `Voix ${index}`, gender: null, count: 0, placeholder: true };
        characters.set(key, entry);
      }
      return entry;
    },
  };
}

/**
 * Analyse un texte nettoyé et renvoie les segments à lire, dans l'ordre,
 * plus la liste des personnages détectés.
 */
export function analyseText(text) {
  const registry = createRegistry();
  const segments = [];
  const recent = [];                 // clés des derniers locuteurs, plus récent en tête
  const mentions = [];               // personnages cités dans la narration, plus récent en tête
  let lastDialogueKey = null;
  let placeholderCount = 0;

  const remember = (key) => {
    const at = recent.indexOf(key);
    if (at !== -1) recent.splice(at, 1);
    recent.unshift(key);
    if (recent.length > 4) recent.pop();
  };

  for (const para of toParagraphs(text)) {
    const { marks, attributions } = markParagraph(para);
    const runs = runsFromMarks(para, marks)
      .map((run) => ({ kind: run.kind, text: cleanRun(run) }))
      .filter((run) => run.text && hasLetters(run.text));
    if (!runs.length) continue;

    for (const run of runs) {
      if (run.kind !== 'narration') continue;
      for (const mention of collectMentions(run.text)) mentions.unshift(mention);
    }
    mentions.splice(8);

    const hasDialogue = runs.some((run) => run.kind === 'dialogue');
    let attribution = attributions[0] || null;
    if (hasDialogue && !attribution) {
      for (const run of runs) {
        if (run.kind !== 'narration') continue;
        attribution = findAttribution(run.text);
        if (attribution) break;
      }
    }

    // Une seule voix par paragraphe : les livres jeunesse ne mélangent presque jamais.
    let speaker = null;
    if (hasDialogue) {
      if (attribution && attribution.name) {
        speaker = registry.register(attribution.name);
      } else if (attribution && attribution.pronoun) {
        speaker = resolvePronoun(attribution, recent, lastDialogueKey, registry.characters);
        if (!speaker) {
          const wanted = /elles?$/.test(attribution.pronoun) ? 'f' : attribution.pronoun === 'on' ? null : 'm';
          const mention = wanted ? mentions.find((entry) => entry.gender === wanted) : null;
          if (mention) speaker = registry.register(mention.name);
        }
      }
      if (!speaker) {
        const alternate = recent.find((key) => key !== lastDialogueKey);
        speaker = alternate
          ? registry.characters.get(alternate)
          : registry.placeholder((placeholderCount += 1));
      }
    }

    for (const run of runs) {
      if (run.kind === 'narration') {
        segments.push({
          id: `s${segments.length}`,
          kind: 'narration',
          text: run.text,
          speakerKey: NARRATOR_KEY,
          speakerName: NARRATOR_NAME,
        });
      } else {
        segments.push({
          id: `s${segments.length}`,
          kind: 'dialogue',
          text: run.text,
          speakerKey: speaker.key,
          speakerName: speaker.name,
        });
      }
    }

    if (speaker) {
      speaker.count += 1;
      remember(speaker.key);
      lastDialogueKey = speaker.key;
    }
  }

  return { segments, characters: sortCharacters(registry.characters, segments) };
}

/**
 * « — Ma maman, dit-il. » : dans un échange, le pronom désigne celui qui prend
 * la parole, donc l'autre — sauf si le verbe prolonge la réplique précédente.
 */
function resolvePronoun({ pronoun, verb }, recent, lastDialogueKey, characters) {
  const wanted = /elles?$/.test(pronoun) ? 'f' : pronoun === 'on' ? null : 'm';
  const compatible = (key) => !wanted || (characters.get(key)?.gender ?? wanted) === wanted;
  const pool = recent.filter(compatible);

  if (!pool.length) return null;          // personne du bon genre : à l'appelant de chercher ailleurs
  if (!CONTINUATION_VERBS.has(verb.toLowerCase())) {
    const alternate = pool.find((key) => key !== lastDialogueKey);
    if (alternate) return characters.get(alternate);
  }
  return characters.get(pool[0]) || null;
}

/**
 * Les noms de personnages cités dans la narration.
 * « La sorcière, cachée derrière un arbre, éclata de rire. » puis
 * « — … s'écria-t-elle. » : c'est la seule piste pour savoir qui parle.
 * On ne retient que les noms propres et les mots dont on connaît le genre,
 * sinon « derrière un arbre » deviendrait un personnage.
 */
const MENTION_RE = new RegExp(`(${COMMON_SRC}|${FAMILY_SRC}|${PROPER_SRC})`, 'g');
const STARTS_WITH_DETERMINER = /^(?:l[ea]s?|l\u2019|un|une|mon|ma|mes|son|sa|ses|leur|leurs|ce|cet|cette|notre|nos|votre|vos)\b/i;

function collectMentions(text) {
  const found = [];
  const re = new RegExp(MENTION_RE.source, 'g');
  let match;
  while ((match = re.exec(text))) {
    const raw = match[1];
    if (isRejectedName(raw)) continue;
    const key = characterKey(raw);
    const bare = key.replace(ADJ_PREFIX_RE, '');
    const known = FEMININE.has(bare) || MASCULINE.has(bare);
    const proper = !STARTS_WITH_DETERMINER.test(raw) && /^[A-Z\u00C0-\u00D6\u00D8-\u00DE]/.test(raw);
    if (!known && !proper) continue;
    const name = tidyName(raw);
    found.push({ name, key, gender: guessGender(name, key) });
  }
  return found;
}

function sortCharacters(characters, segments) {
  const counts = new Map();
  for (const segment of segments) {
    if (segment.kind !== 'dialogue') continue;
    counts.set(segment.speakerKey, (counts.get(segment.speakerKey) || 0) + 1);
  }
  return [...characters.values()]
    .map((entry) => ({ ...entry, count: counts.get(entry.key) || 0 }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'fr'));
}

/** Recalcule la liste des personnages après une correction manuelle. */
export function recountCharacters(segments, known = []) {
  const byKey = new Map(known.map((entry) => [entry.key, entry]));
  const counts = new Map();
  for (const segment of segments) {
    if (segment.kind !== 'dialogue') continue;
    counts.set(segment.speakerKey, (counts.get(segment.speakerKey) || 0) + 1);
    if (!byKey.has(segment.speakerKey)) {
      byKey.set(segment.speakerKey, {
        key: segment.speakerKey,
        name: segment.speakerName,
        gender: guessGender(segment.speakerName, segment.speakerKey),
        placeholder: /^__voix_/.test(segment.speakerKey),
      });
    }
  }
  return [...byKey.values()]
    .map((entry) => ({ ...entry, count: counts.get(entry.key) || 0 }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'fr'));
}
