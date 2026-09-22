/** Point d'entrée : service worker, navigation, et écran d'accueil. */

import { qs, toast } from './ui.js';
import { router } from './router.js';
import { session } from './state.js';
import { listBooks } from './store.js';
import { loadVoices, frenchVoices } from './voices.js';
import { createLiveReader } from './live-reader.js';
import { createScanScreen } from './screens/scan.js';
import { createPrepareScreen } from './screens/prepare.js';
import { createCastScreen } from './screens/cast.js';
import { createReadScreen } from './screens/read.js';
import { createLibraryScreen } from './screens/library.js';
import { createSettingsScreen } from './screens/settings.js';

/**
 * iOS n'autorise la synthèse vocale que si elle a déjà été déclenchée par un
 * geste. On « débloque » donc au tout premier contact avec l'écran.
 */
function unlockSpeechOnFirstGesture() {
  if (!globalThis.speechSynthesis) return;
  const unlock = () => {
    try {
      const silence = new SpeechSynthesisUtterance(' ');
      silence.volume = 0;
      speechSynthesis.speak(silence);
      speechSynthesis.cancel();
    } catch { /* sans importance */ }
    document.removeEventListener('pointerdown', unlock);
    document.removeEventListener('touchstart', unlock);
  };
  document.addEventListener('pointerdown', unlock, { once: true });
  document.addEventListener('touchstart', unlock, { once: true });
}

function createHomeScreen(live) {
  let stopWatchingVoices = null;

  return {
    async mount() {
      session.reset();
      live.forget();                    // nouveau livre : on oublie la page précédente
      const note = qs('#home-library-note');
      const status = qs('#home-status');

      try {
        const books = await listBooks();
        note.textContent = books.length
          ? `${books.length} livre${books.length > 1 ? 's' : ''} rangé${books.length > 1 ? 's' : ''}`
          : 'Encore vide';
      } catch {
        note.textContent = 'Les pages déjà lues';
      }

      if (!globalThis.speechSynthesis) {
        status.textContent = "Ce navigateur ne sait pas lire à voix haute.";
        return;
      }

      // iOS publie parfois ses voix après le chargement de la page : on annonce
      // leur absence seulement une fois, et on efface dès qu'elles arrivent.
      const refresh = async () => {
        const voices = frenchVoices(await loadVoices());
        status.textContent = voices.length
          ? ''
          : "Aucune voix française installée : ajoute-en dans les réglages du téléphone.";
      };
      const onVoicesChanged = () => { refresh(); };
      speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
      stopWatchingVoices = () => speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
      await refresh();
    },

    unmount() {
      stopWatchingVoices?.();
      stopWatchingVoices = null;
    },
  };
}

function wireGlobalNavigation() {
  document.addEventListener('click', (event) => {
    const goButton = event.target.closest('[data-go]');
    if (goButton) { router.go(goButton.dataset.go); return; }
    if (event.target.closest('[data-back]')) router.back();
  });
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  try {
    await navigator.serviceWorker.register('sw.js');
  } catch {
    // Pas de mode hors-ligne : l'app fonctionne quand même tant qu'il y a du réseau.
  }
}

function start() {
  unlockSpeechOnFirstGesture();
  wireGlobalNavigation();

  const live = createLiveReader(qs('#camera'), qs('#camera-layer'));

  // La caméra n'a de raison d'être que sur la visée et la lecture : partout
  // ailleurs on l'éteint, sans que chaque écran ait à y penser.
  const KEEPS_CAMERA = new Set(['scan', 'read']);
  const register = (name, screen) => router.register(name, {
    async mount(params, options) {
      if (!KEEPS_CAMERA.has(name)) await live.setMode('off');
      return screen.mount?.(params, options);
    },
    unmount: () => screen.unmount?.(),
  });

  register('home', createHomeScreen(live));
  register('scan', createScanScreen(live));
  register('prepare', createPrepareScreen());
  register('cast', createCastScreen());
  register('read', createReadScreen(live));
  register('library', createLibraryScreen());
  register('settings', createSettingsScreen());

  router.start('home');
  registerServiceWorker();

  window.addEventListener('error', (event) => {
    console.error(event.error || event.message);
    toast("Quelque chose s'est mal passé. Reviens à l'accueil et réessaie.", 'error');
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
