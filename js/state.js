/** L'état de la lecture en cours : la page scannée, ses répliques, sa distribution. */

import { cleanOcrText } from './text.js';
import { analyseText, recountCharacters, NARRATOR_KEY } from './dialogue.js';
import { autoCast } from './casting.js';
import { createBook, saveBook, addPage, listPages } from './store.js';

export const session = {
  book: null,
  page: null,
  text: '',
  segments: [],
  characters: [],
  casting: { [NARRATOR_KEY]: 'narrateur' },
  thumb: null,
  confidence: 0,

  /** Analyse un texte brut (sortie OCR ou corrigé à la main). */
  setRawText(raw) {
    this.text = cleanOcrText(raw);
    this.reanalyse();
    return this.text;
  },

  /** Analyse un texte déjà propre, sans repasser par le nettoyage OCR. */
  setText(text) {
    this.text = text;
    this.reanalyse();
    return this.text;
  },

  reanalyse() {
    const { segments, characters } = analyseText(this.text);
    this.segments = segments;
    this.characters = characters;
    this.casting = autoCast(characters, { ...this.casting, [NARRATOR_KEY]: this.casting[NARRATOR_KEY] || 'narrateur' });
  },

  /** Après une correction manuelle de « qui parle ». */
  refreshCharacters() {
    this.characters = recountCharacters(this.segments, this.characters);
    this.casting = autoCast(this.characters, this.casting);
  },

  renameCharacter(key, name) {
    for (const segment of this.segments) {
      if (segment.speakerKey === key) segment.speakerName = name;
    }
    const character = this.characters.find((entry) => entry.key === key);
    if (character) { character.name = name; character.placeholder = false; }
    if (this.book) {
      this.book.names = { ...this.book.names, [key]: name };
    }
  },

  reassignSegment(segmentId, speakerKey, speakerName) {
    const segment = this.segments.find((entry) => entry.id === segmentId);
    if (!segment) return;
    segment.speakerKey = speakerKey;
    segment.speakerName = speakerName;
    segment.kind = speakerKey === NARRATOR_KEY ? 'narration' : 'dialogue';
    this.refreshCharacters();
  },

  /** Enregistre la page courante dans la bibliothèque. */
  async persist(titleHint) {
    if (!this.book) {
      this.book = await createBook(titleHint || defaultTitle(this.text));
    }
    this.book.casting = { ...this.book.casting, ...this.casting };
    await saveBook(this.book);
    this.page = await addPage(this.book.id, {
      text: this.text,
      segments: this.segments,
      thumb: this.thumb,
    });
    return this.page;
  },

  /** Recharge une page de la bibliothèque. */
  loadPage(book, page) {
    this.book = book;
    this.page = page;
    this.text = page.text;
    this.segments = page.segments || [];
    this.thumb = page.thumb || null;
    this.confidence = 0;
    this.characters = recountCharacters(this.segments);
    this.casting = autoCast(this.characters, { ...(book.casting || {}), [NARRATOR_KEY]: 'narrateur' });
    for (const [key, name] of Object.entries(book.names || {})) this.renameCharacter(key, name);
  },

  reset() {
    this.book = null;
    this.page = null;
    this.text = '';
    this.segments = [];
    this.characters = [];
    this.casting = { [NARRATOR_KEY]: 'narrateur' };
    this.thumb = null;
    this.confidence = 0;
  },
};

/** Un titre par défaut tiré des premiers mots de la page. */
function defaultTitle(text) {
  const words = String(text || '').replace(/\s+/g, ' ').trim().split(' ').slice(0, 6).join(' ');
  return words ? `${words}…` : 'Livre sans titre';
}

export { listPages };
