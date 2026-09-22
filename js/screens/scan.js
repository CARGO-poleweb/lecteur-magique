/** Écran caméra : cadrer la page, la photographier, la faire lire par l'OCR. */

import { qs, toast, setBusy } from '../ui.js';
import { settings } from '../settings.js';
import { createCamera } from '../camera.js';
import { loadImage, makeThumb } from '../imaging.js';
import { readPage } from '../ocr.js';
import { cleanOcrText, looksEmpty } from '../text.js';
import { session } from '../state.js';
import { router } from '../router.js';

export function createScanScreen() {
  const video = qs('#camera');
  const fileInput = qs('#scan-file');
  const torchButton = qs('#scan-torch');
  const camera = createCamera(video);
  let torchOn = false;
  let wired = false;

  async function analyse(source) {
    try {
      setBusy('Préparation…', 0);
      const { text, confidence } = await readPage(source, {
        enhance: settings.get('enhanceImage'),
        onProgress: (label, progress) => setBusy(label, progress),
      });
      const cleaned = cleanOcrText(text);
      setBusy(false);

      if (looksEmpty(cleaned)) {
        toast("Je n'ai pas réussi à lire cette page. Essaie avec plus de lumière, ou plus près.", 'error');
        return;
      }
      session.thumb = makeThumb(source);
      session.confidence = Math.round(confidence);
      session.setText(cleaned);
      await router.go('prepare');
    } catch (error) {
      setBusy(false);
      toast(error.message, 'error');
    }
  }

  function wire() {
    if (wired) return;
    wired = true;

    qs('#scan-back').addEventListener('click', () => router.back());

    qs('#scan-shoot').addEventListener('click', async () => {
      try {
        await analyse(camera.capture());
      } catch (error) {
        toast(error.message, 'error');
      }
    });

    qs('#scan-gallery').addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      fileInput.value = '';
      if (!file) return;
      try {
        await analyse(await loadImage(file));
      } catch (error) {
        toast(error.message, 'error');
      }
    });

    torchButton.addEventListener('click', async () => {
      if (!camera.hasTorch()) { toast("Cet appareil n'a pas de lampe pilotable."); return; }
      torchOn = !torchOn;
      const done = await camera.setTorch(torchOn);
      if (!done) { torchOn = false; toast("La lampe n'a pas pu être allumée."); }
      torchButton.setAttribute('aria-pressed', String(torchOn));
    });

    qs('#scan-flip').addEventListener('click', async () => {
      try { await camera.flip(); } catch (error) { toast(error.message, 'error'); }
    });
  }

  return {
    async mount() {
      wire();
      torchOn = false;
      torchButton.setAttribute('aria-pressed', 'false');
      try {
        await camera.start();
      } catch (error) {
        toast(`${error.message} Tu peux quand même choisir une photo existante.`, 'error');
      }
    },
    unmount() {
      camera.stop();
    },
  };
}
