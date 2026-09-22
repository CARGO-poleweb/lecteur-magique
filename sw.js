/**
 * Service worker.
 *
 * Deux régimes, parce que les fichiers n'ont pas la même nature :
 *
 *   — l'application elle-même (html, css, js) change à chaque mise en ligne.
 *     Elle est donc servie **par le réseau d'abord**, le cache ne servant que
 *     de filet hors-ligne. Servir le cache en premier, comme le veut l'usage,
 *     condamnait l'utilisateur à voir la version de la veille.
 *
 *   — le moteur de reconnaissance et le modèle français (dossier `vendor/`)
 *     pèsent une dizaine de mégaoctets et ne changent presque jamais : eux
 *     sont servis **par le cache d'abord**, et gardés à travers les mises à jour.
 */

const CACHE_VERSION = '1.2.0';
const APP_CACHE = `lecteur-app-${CACHE_VERSION}`;
const VENDOR_CACHE = 'lecteur-vendor-v1';       // survit aux mises à jour de l'app

const APP_SHELL = [
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
  './js/version.js',
  './js/text.js',
  './js/dialogue.js',
  './js/casting.js',
  './js/voices.js',
  './js/player.js',
  './js/premium.js',
  './js/imaging.js',
  './js/camera.js',
  './js/live.js',
  './js/live-reader.js',
  './js/ocr.js',
  './js/screens/scan.js',
  './js/screens/prepare.js',
  './js/screens/cast.js',
  './js/screens/read.js',
  './js/screens/library.js',
  './js/screens/settings.js',
  './js/screens/premium.js',
];

const isVendor = (url) => url.pathname.includes('/vendor/');

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_CACHE);
    // Un fichier manquant ne doit pas faire échouer toute l'installation.
    await Promise.all(APP_SHELL.map((url) => cache.add(url).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name !== APP_CACHE && name !== VENDOR_CACHE)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;     // ElevenLabs et le reste : direct au réseau

  // Gros fichiers immuables : le cache d'abord, sinon on les retélécharge pour rien.
  if (isVendor(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(VENDOR_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) cache.put(request, response.clone()).catch(() => {});
      return response;
    })());
    return;
  }

  // L'application : le réseau d'abord, pour ne jamais rester bloqué sur une
  // version périmée ; le cache prend le relais dès qu'il n'y a plus de réseau.
  event.respondWith((async () => {
    const cache = await caches.open(APP_CACHE);
    try {
      const response = await fetch(request);
      if (response.ok) cache.put(request, response.clone()).catch(() => {});
      return response;
    } catch {
      const cached = await cache.match(request);
      if (cached) return cached;
      if (request.mode === 'navigate') {
        const fallback = await cache.match('./index.html');
        if (fallback) return fallback;
      }
      return new Response('Hors-ligne', { status: 503, statusText: 'Hors-ligne' });
    }
  })());
});
