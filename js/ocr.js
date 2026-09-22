/**
 * Reconnaissance de texte, entièrement dans le navigateur (Tesseract.js).
 *
 * Le moteur et le modèle français sont servis par l'application elle-même
 * (dossier `vendor/`) : aucun CDN, aucune page qui part ailleurs, et tout
 * fonctionne hors-ligne une fois les fichiers mis en cache.
 */

import { prepareForOcr } from './imaging.js';
import { looksEmpty } from './text.js';

/** Chemins absolus : le worker de Tesseract ne partage pas notre base d'URL. */
const asset = (path) => new URL(path, document.baseURI).href;

const ENGINE = {
  script: asset('vendor/tesseract/tesseract.min.js'),
  worker: asset('vendor/tesseract/worker.min.js'),
  core: asset('vendor/tesseract/'),
  langs: asset('vendor/tessdata'),
};

const STEP_LABELS = {
  'loading tesseract core': 'Chargement du moteur…',
  'initializing tesseract': 'Préparation du moteur…',
  'loading language traineddata': 'Téléchargement du français…',
  'initializing api': 'Presque prêt…',
  'recognizing text': 'Lecture de la page…',
};

let scriptPromise = null;
let workerPromise = null;

function loadScript(src) {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve(globalThis.Tesseract);
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Le moteur de lecture n'a pas pu être chargé."));
    };
    document.head.append(script);
  });
  return scriptPromise;
}

/** Démarre (une seule fois) le worker Tesseract en français. */
export async function getWorker(onProgress = () => {}) {
  if (workerPromise) return workerPromise;
  workerPromise = (async () => {
    const Tesseract = await loadScript(ENGINE.script);
    // oem 1 = moteur LSTM seul, le seul dont on embarque le noyau.
    const worker = await Tesseract.createWorker('fra', 1, {
      workerPath: ENGINE.worker,
      corePath: ENGINE.core,
      langPath: ENGINE.langs,
      gzip: true,
      logger: (message) => {
        const label = STEP_LABELS[message.status];
        if (label) onProgress(label, message.progress ?? null);
      },
    });
    await worker.setParameters({
      tessedit_pageseg_mode: '3',        // page entière, colonne unique détectée seule
      preserve_interword_spaces: '1',
    });
    return worker;
  })().catch((error) => {
    workerPromise = null;
    throw error;
  });
  return workerPromise;
}

/**
 * Lit une page. Si le pré-traitement a trop mangé l'image (texte blanc sur
 * fond coloré, illustration pleine page…), on retente sur la photo brute.
 */
export async function readPage(source, { enhance = true, onProgress = () => {} } = {}) {
  const worker = await getWorker(onProgress);

  const attempt = async (useEnhance) => {
    const canvas = prepareForOcr(source, { enhance: useEnhance });
    onProgress('Lecture de la page…', null);
    const { data } = await worker.recognize(canvas);
    return { text: data.text || '', confidence: data.confidence ?? 0, canvas, enhanced: useEnhance };
  };

  let result = await attempt(enhance);
  if (enhance && (looksEmpty(result.text) || result.confidence < 45)) {
    const fallback = await attempt(false);
    if (fallback.confidence > result.confidence) result = fallback;
  }
  return result;
}

export async function releaseWorker() {
  if (!workerPromise) return;
  const worker = await workerPromise.catch(() => null);
  workerPromise = null;
  await worker?.terminate?.();
}
