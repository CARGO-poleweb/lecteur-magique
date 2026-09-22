/** Écran de distribution : une voix par personnage, écoutable avant de valider. */

import { qs, el, clear, promptBox } from '../ui.js';
import { session } from '../state.js';
import { router } from '../router.js';
import { colorForKey } from '../palette.js';
import { TIMBRES, timbreById, autoCast } from '../casting.js';
import { previewTimbre } from '../player.js';
import { NARRATOR_KEY, NARRATOR_NAME } from '../dialogue.js';
import { saveBook } from '../store.js';

export function createCastScreen() {
  const host = qs('#cast-list');
  let wired = false;

  function row(key, name, count, { renamable }) {
    const chosen = session.casting[key] || 'narrateur';
    const strip = el('div', { class: 'timbre-strip' });

    for (const timbre of TIMBRES) {
      const button = el('button', {
        class: 'timbre',
        'aria-pressed': String(timbre.id === chosen),
        onClick: () => {
          session.casting[key] = timbre.id;
          previewTimbre(timbre, `Bonjour, je suis ${name}.`);
          render();
        },
      }, [
        el('span', { class: 'timbre-emoji', 'aria-hidden': 'true' }, timbre.emoji),
        el('span', {}, timbre.name),
      ]);
      strip.append(button);
    }

    const head = el('div', { class: 'cast-head' }, [
      el('span', { class: 'timbre-emoji', 'aria-hidden': 'true' }, timbreById(chosen).emoji),
      el('span', { class: 'cast-name', style: `color:${colorForKey(key)}` }, name),
      count ? el('span', { class: 'cast-count' }, `${count} réplique${count > 1 ? 's' : ''}`) : null,
      el('button', {
        class: 'round-button',
        'aria-label': 'Écouter cette voix',
        onClick: () => previewTimbre(timbreById(session.casting[key] || 'narrateur'), `Bonjour, je suis ${name}.`),
      }, '🔊'),
    ]);

    if (renamable) {
      head.querySelector('.cast-name').addEventListener('click', async () => {
        const next = await promptBox('Comment s’appelle ce personnage ?', name);
        if (!next) return;
        session.renameCharacter(key, next);
        render();
      });
      head.querySelector('.cast-name').style.cursor = 'pointer';
      head.querySelector('.cast-name').title = 'Renommer';
    }

    return el('div', { class: 'cast-row' }, [head, strip]);
  }

  function render() {
    clear(host);
    host.append(row(NARRATOR_KEY, NARRATOR_NAME, 0, { renamable: false }));
    for (const character of session.characters) {
      host.append(row(character.key, character.name, character.count, { renamable: true }));
    }
    if (!session.characters.length) {
      host.append(el('p', { class: 'empty' }, [
        el('span', { class: 'empty-emoji', 'aria-hidden': 'true' }, '🎭'),
        'Aucun personnage détecté sur cette page — seul le narrateur parle.',
      ]));
    }
  }

  async function remember() {
    if (!session.book) return;
    session.book.casting = { ...session.book.casting, ...session.casting };
    await saveBook(session.book).catch(() => { /* la lecture marche quand même */ });
  }

  function wire() {
    if (wired) return;
    wired = true;
    qs('#cast-auto').addEventListener('click', () => {
      session.casting = autoCast(session.characters, { [NARRATOR_KEY]: 'narrateur' });
      render();
    });
  }

  return {
    mount() { wire(); render(); },
    unmount() { remember(); },
  };
}
