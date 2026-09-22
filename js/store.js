/**
 * Bibliothèque locale : livres, pages scannées, et cache audio des voix premium.
 * Tout reste dans IndexedDB, sur l'appareil. Rien ne part sur un serveur.
 */

const DB_NAME = 'lecteur-magique';
const DB_VERSION = 1;

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('books')) {
        db.createObjectStore('books', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('pages')) {
        const pages = db.createObjectStore('pages', { keyPath: 'id' });
        pages.createIndex('byBook', 'bookId');
      }
      if (!db.objectStoreNames.contains('audio')) {
        db.createObjectStore('audio', { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function run(storeName, mode, work) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const request = work(tx.objectStore(storeName));
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
    if (request) {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    } else {
      tx.oncomplete = () => resolve();
    }
  }));
}

export const uid = () => (globalThis.crypto?.randomUUID
  ? crypto.randomUUID()
  : `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

export const store = {
  put: (name, value) => run(name, 'readwrite', (s) => s.put(value)),
  get: (name, key) => run(name, 'readonly', (s) => s.get(key)),
  all: (name) => run(name, 'readonly', (s) => s.getAll()),
  remove: (name, key) => run(name, 'readwrite', (s) => s.delete(key)),
  clear: (name) => run(name, 'readwrite', (s) => s.clear()),
  byIndex: (name, indexName, key) => run(name, 'readonly', (s) => s.index(indexName).getAll(key)),
};

/** Crée un livre et renvoie sa fiche. */
export async function createBook(title) {
  const book = {
    id: uid(),
    title: title || 'Livre sans titre',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    casting: {},            // clé de personnage → identifiant de voix
    names: {},              // clé de personnage → nom affiché (renommable)
  };
  await store.put('books', book);
  return book;
}

export async function saveBook(book) {
  book.updatedAt = Date.now();
  await store.put('books', book);
  return book;
}

export async function listBooks() {
  const books = await store.all('books');
  return books.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function listPages(bookId) {
  const pages = await store.byIndex('pages', 'byBook', bookId);
  return pages.sort((a, b) => a.index - b.index);
}

export async function addPage(bookId, { text, segments, thumb }) {
  const existing = await listPages(bookId);
  const page = {
    id: uid(),
    bookId,
    index: existing.length,
    createdAt: Date.now(),
    text,
    segments,
    thumb,
  };
  await store.put('pages', page);
  return page;
}

export async function deleteBook(bookId) {
  const pages = await listPages(bookId);
  await Promise.all(pages.map((page) => store.remove('pages', page.id)));
  await store.remove('books', bookId);
}

/** Cache des extraits audio générés par une voix premium (évite de repayer). */
export const audioCache = {
  get: (key) => store.get('audio', key).then((row) => row?.blob || null),
  put: (key, blob) => store.put('audio', { key, blob, createdAt: Date.now() }),
  clear: () => store.clear('audio'),
  async size() {
    const rows = await store.all('audio');
    return rows.reduce((total, row) => total + (row.blob?.size || 0), 0);
  },
};
