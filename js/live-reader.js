/**
 * Lecture en direct : la caméra reste ouverte, l'application décide toute seule
 * quand une page est lisible, la reconnaît, puis attend qu'on tourne la page.
 *
 * Aucun déclencheur : l'enfant tient le téléphone au-dessus du livre, c'est tout.
 */

import { createCamera } from './camera.js';
import { createWatcher, toGrayscale, meanAbsDiff, laplacianVariance, inkRatio } from './live.js';
import { readPage } from './ocr.js';
import { cleanOcrText, looksEmpty, textSimilarity } from './text.js';
import { makeThumb } from './imaging.js';
import { settings } from './settings.js';

const ANALYSIS_WIDTH = 320;
const ANALYSIS_HEIGHT = 240;
const FRAME_INTERVAL = 160;          // ≈ 6 images par seconde : assez pour juger, pas assez pour chauffer
const CROP = 0.6;                    // on n'analyse que le centre du cadre
const SAME_PAGE = 0.7;               // au-delà, c'est toujours la même page

export function createLiveReader(video, layer, initialHandlers = {}) {
  let handlers = initialHandlers;
  const camera = createCamera(video);
  const watcher = createWatcher();
  const canvas = document.createElement('canvas');
  canvas.width = ANALYSIS_WIDTH;
  canvas.height = ANALYSIS_HEIGHT;
  const context = canvas.getContext('2d', { willReadFrequently: true });

  let buffers = [new Uint8Array(ANALYSIS_WIDTH * ANALYSIS_HEIGHT), new Uint8Array(ANALYSIS_WIDTH * ANALYSIS_HEIGHT)];
  let hasPrevious = false;
  let timer = null;
  let running = false;
  let busy = false;
  let mode = 'off';
  let lastText = '';
  let searchingSince = 0;

  const setLayer = (className) => { if (layer) layer.className = `camera-layer ${className}`; };
  const status = (state, extra) => handlers.onStatus?.(state, extra);

  function schedule() {
    clearTimeout(timer);
    if (running) timer = setTimeout(tick, FRAME_INTERVAL);
  }

  function tick() {
    if (!running || busy) { schedule(); return; }
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height || document.hidden) { schedule(); return; }

    const cropWidth = Math.round(width * CROP);
    const cropHeight = Math.round(height * CROP);
    context.drawImage(video,
      (width - cropWidth) / 2, (height - cropHeight) / 2, cropWidth, cropHeight,
      0, 0, ANALYSIS_WIDTH, ANALYSIS_HEIGHT);

    const pixels = context.getImageData(0, 0, ANALYSIS_WIDTH, ANALYSIS_HEIGHT).data;
    const gray = toGrayscale(pixels, buffers[0]);
    const motion = hasPrevious ? meanAbsDiff(gray, buffers[1]) : Infinity;
    const sharpness = laplacianVariance(gray, ANALYSIS_WIDTH, ANALYSIS_HEIGHT);
    const ink = inkRatio(gray);
    buffers = [buffers[1], buffers[0]];        // l'image courante devient la précédente
    hasPrevious = true;

    const state = watcher.push({ motion, sharpness, ink });
    if (state === 'searching' || state === 'steady') {
      if (!searchingSince) searchingSince = Date.now();
      status(state, { motion, sharpness, ink, waiting: Date.now() - searchingSince });
    }
    if (state === 'ready') { read(); return; }
    schedule();
  }

  /** Reconnaît la page tenue devant l'objectif. */
  async function read() {
    if (busy) return;
    busy = true;
    watcher.consume();
    status('reading');
    try {
      const frame = camera.capture();
      const { text, confidence } = await readPage(frame, {
        enhance: settings.get('enhanceImage'),
        onProgress: (label, progress) => handlers.onProgress?.(label, progress),
      });
      const cleaned = cleanOcrText(text);

      if (looksEmpty(cleaned)) { status('unreadable'); return; }
      if (lastText && textSimilarity(cleaned, lastText) > SAME_PAGE) { status('same'); return; }

      lastText = cleaned;
      searchingSince = 0;
      await handlers.onPage?.({ text: cleaned, thumb: makeThumb(frame), confidence: Math.round(confidence) });
    } catch (error) {
      handlers.onError?.(error);
    } finally {
      busy = false;
      hasPrevious = false;                      // on repart sur une image de référence propre
      schedule();
    }
  }

  return {
    /** L'écran affiché reprend la main sur les événements. */
    setHandlers(next) { handlers = next || {}; },

    /** 'full' plein écran, 'mini' en vignette pendant la lecture, 'off' caméra éteinte. */
    async setMode(next) {
      if (next === mode && (next === 'off' || camera.active)) return;
      mode = next;

      if (next === 'off') {
        running = false;
        clearTimeout(timer);
        camera.stop();
        setLayer('is-off');
        return;
      }

      setLayer(next === 'full' ? 'is-full' : 'is-mini');
      if (!camera.active) {
        try {
          await camera.start();
        } catch (error) {
          setLayer('is-off');
          handlers.onError?.(error);
          return;
        }
      }
      watcher.reset();
      hasPrevious = false;
      searchingSince = 0;
      running = true;
      schedule();
    },

    /** Bouton de secours : lire ce qu'il y a là, maintenant. */
    readNow() { watcher.reset(); read(); },

    /** Après une correction manuelle du texte, pour ne pas reproposer la même page. */
    remember(text) { lastText = text; },

    /** Repartir de zéro (nouveau livre). */
    forget() { lastText = ''; watcher.reset(); },

    get mode() { return mode; },
    get busy() { return busy; },
    hasTorch: () => camera.hasTorch(),
    setTorch: (on) => camera.setTorch(on),
    flip: () => camera.flip(),
  };
}
