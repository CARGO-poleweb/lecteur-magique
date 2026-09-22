/**
 * Service worker : l'app démarre hors-ligne, et le moteur de lecture ainsi que
 * le modèle français sont conservés après le premier scan.
 */

const SHELL_CACHE = 'lecteur-shell-v1';
const RUNTIME_CACHE = 'lecteur-runtime-v1';

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './styles/app.css',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './js/main.js',
  './js/router.js',
  './js/ui.js',
  './js/state.js',
  './js/settings.js',
  './js/store.js',
  './js/palette.js',
  './js/text.js',
  './js/dialogue.js',
  './js/casting.js',
  './js/voices.js',
  './js/player.js',
  './js/premium.js',
  './js/imaging.js',
  './js/camera.js',
  './js/ocr.js',
  './js/screens/scan.js',
  './js/screens/prepare.js',
  './js/screens/cast.js',
  './js/screens/read.js',
  './js/screens/library.js',
  './js/screens/settings.js',
];

/** L'application ne dépend d'aucun CDN : seul son propre domaine est mis en cache.
 *  (Le moteur OCR et le modèle français sont servis depuis `vendor/`.) */
const CACHEABLE_HOSTS = [];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    // Un fichier manquant ne doit pas faire échouer toute l'installation.
    await Promise.all(SHELL.map((url) => cache.add(url).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name !== SHELL_CACHE && name !== RUNTIME_CACHE)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  const cacheable = sameOrigin || CACHEABLE_HOSTS.includes(url.hostname);
  if (!cacheable) return;                       // ElevenLabs et le reste : direct au réseau.

  event.respondWith((async () => {
    const cacheName = sameOrigin ? SHELL_CACHE : RUNTIME_CACHE;
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);

    const fromNetwork = fetch(request).then((response) => {
      if (response && (response.ok || response.type === 'opaque')) {
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    }).catch(() => null);

    // Le cache répond tout de suite ; la copie fraîche arrive pour la prochaine fois.
    if (cached) { event.waitUntil(fromNetwork); return cached; }

    const response = await fromNetwork;
    if (response) return response;
    if (request.mode === 'navigate') {
      const fallback = await cache.match('./index.html');
      if (fallback) return fallback;
    }
    return new Response('Hors-ligne', { status: 503, statusText: 'Hors-ligne' });
  })());
});
