/** Bibliothèque : les livres déjà scannés, page par page. */

import { qs, el, clear, toast, confirmBox, promptBox } from '../ui.js';
import { listBooks, listPages, deleteBook, saveBook } from '../store.js';
import { session } from '../state.js';
import { router } from '../router.js';

const dateLabel = (stamp) => new Date(stamp).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
const firstWords = (text, count = 9) => String(text || '').replace(/\s+/g, ' ').trim().split(' ').slice(0, count).join(' ');

export function createLibraryScreen() {
  const host = qs('#library-list');
  const expanded = new Set();

  async function openPage(book, page) {
    session.loadPage(book, page);
    await router.go('read');
  }

  function pageRow(book, page) {
    return el('button', {
      class: 'book-card page-card',
      onClick: () => openPage(book, page),
    }, [
      page.thumb ? el('img', { class: 'book-cover', src: page.thumb, alt: '' }) : el('span', { class: 'book-cover' }),
      el('span', { class: 'book-info' }, [
        el('span', { class: 'book-title' }, `Page ${page.index + 1}`),
        el('span', { class: 'book-meta' }, firstWords(page.text)),
      ]),
      el('span', { 'aria-hidden': 'true' }, '▶️'),
    ]);
  }

  async function render() {
    clear(host);
    const books = await listBooks();

    if (!books.length) {
      host.append(el('div', { class: 'empty' }, [
        el('span', { class: 'empty-emoji', 'aria-hidden': 'true' }, '📚'),
        el('p', {}, 'La bibliothèque est vide.'),
        el('button', { class: 'btn btn-primary', onClick: () => router.go('scan') }, '📷 Scanner une première page'),
      ]));
      return;
    }

    for (const book of books) {
      const pages = await listPages(book.id);
      const cover = pages.find((page) => page.thumb)?.thumb;

      host.append(el('button', {
        class: 'book-card',
        onClick: () => {
          if (expanded.has(book.id)) expanded.delete(book.id);
          else expanded.add(book.id);
          render();
        },
      }, [
        cover ? el('img', { class: 'book-cover', src: cover, alt: '' }) : el('span', { class: 'book-cover' }),
        el('span', { class: 'book-info' }, [
          el('span', { class: 'book-title' }, book.title),
          el('span', { class: 'book-meta' }, `${pages.length} page${pages.length > 1 ? 's' : ''} · ${dateLabel(book.updatedAt)}`),
        ]),
        el('span', { 'aria-hidden': 'true' }, expanded.has(book.id) ? '▾' : '▸'),
      ]));

      if (!expanded.has(book.id)) continue;

      const panel = el('div', { class: 'panel' });
      pages.forEach((page) => panel.append(pageRow(book, page)));
      panel.append(el('div', { class: 'modal-actions' }, [
        el('button', {
          class: 'chip',
          onClick: async () => {
            const title = await promptBox('Nom du livre', book.title);
            if (!title) return;
            book.title = title;
            await saveBook(book);
            render();
          },
        }, '✏️ Renommer'),
        el('button', {
          class: 'chip',
          onClick: async () => {
            session.loadPage(book, pages[0] || { text: '', segments: [] });
            session.page = null;
            await router.go('scan');
          },
        }, '📷 Ajouter une page'),
        el('button', {
          class: 'chip',
          onClick: async () => {
            const sure = await confirmBox(`Supprimer « ${book.title} » et ses ${pages.length} page(s) ?`, { confirmLabel: 'Supprimer' });
            if (!sure) return;
            await deleteBook(book.id);
            expanded.delete(book.id);
            toast('Livre supprimé.');
            render();
          },
        }, '🗑️ Supprimer'),
      ]));
      host.append(panel);
    }
  }

  return { mount: render };
}
