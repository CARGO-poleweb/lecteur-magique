/**
 * Écran de visée. Il n'y a rien à déclencher : la caméra tourne, l'application
 * repère toute seule une page nette et immobile, et part lire.
 */

import { qs, toast, setBusy } from '../ui.js';
import { settings } from '../settings.js';
import { loadImage, makeThumb } from '../imaging.js';
import { readPage } from '../ocr.js';
import { cleanOcrText, looksEmpty } from '../text.js';
import { session } from '../state.js';
import { router } from '../router.js';

const MESSAGES = {
  searching: 'Montre-moi une page 👀',
  steady: 'Ne bouge plus…',
  reading: 'Je lis la page…',
  unreadable: "Je n'y arrive pas. Rapproche-toi, ou allume la lampe.",
  same: 'C’est toujours la même page.',
};

/** Au bout de ce délai sans succès, on propose une porte de sortie. */
const RESCUE_AFTER = 7000;

export function createScanScreen(live) {
  const status = qs('#scan-status');
  const rescue = qs('#scan-force');
  const fileInput = qs('#scan-file');
  const torchButton = qs('#scan-torch');
  let torchOn = false;
  let wired = false;

  function setStatus(state, info = {}) {
    status.textContent = MESSAGES[state] || MESSAGES.searching;
    status.dataset.state = state;
    rescue.hidden = !(state !== 'reading' && info.waiting > RESCUE_AFTER);
  }

  async function acceptPage({ text, thumb, confidence }) {
    session.thumb = thumb;
    session.confidence = confidence;
    session.setText(text);
    try { await session.persist(); } catch { /* la lecture prime sur le rangement */ }
    await router.go('read');
  }

  /** Repli : une photo déjà prise, choisie dans la galerie. */
  async function analyseFile(file) {
    try {
      setBusy('Lecture de la page…', 0);
      const image = await loadImage(file);
      const { text, confidence } = await readPage(image, {
        enhance: settings.get('enhanceImage'),
        onProgress: (label, progress) => setBusy(label, progress),
      });
      const cleaned = cleanOcrText(text);
      setBusy(false);
      if (looksEmpty(cleaned)) { toast("Je n'ai pas réussi à lire cette image.", 'error'); return; }
      live.remember(cleaned);
      await acceptPage({ text: cleaned, thumb: makeThumb(image), confidence: Math.round(confidence) });
    } catch (error) {
      setBusy(false);
      toast(error.message, 'error');
    }
  }

  function wire() {
    if (wired) return;
    wired = true;

    qs('#scan-back').addEventListener('click', () => router.back());
    rescue.addEventListener('click', () => { rescue.hidden = true; live.readNow(); });
    qs('#scan-gallery').addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      fileInput.value = '';
      if (file) analyseFile(file);
    });

    torchButton.addEventListener('click', async () => {
      if (!live.hasTorch()) { toast("Cet appareil n'a pas de lampe pilotable."); return; }
      torchOn = !torchOn;
      if (!await live.setTorch(torchOn)) { torchOn = false; toast("La lampe n'a pas pu être allumée."); }
      torchButton.setAttribute('aria-pressed', String(torchOn));
    });

    qs('#scan-flip').addEventListener('click', () => live.flip().catch((error) => toast(error.message, 'error')));
  }

  return {
    async mount() {
      wire();
      torchOn = false;
      torchButton.setAttribute('aria-pressed', 'false');
      rescue.hidden = true;
      setStatus('searching');

      live.setHandlers({
        onStatus: setStatus,
        onPage: acceptPage,
        onError: (error) => toast(error.message, 'error'),
      });
      await live.setMode('full');
    },
  };
}
