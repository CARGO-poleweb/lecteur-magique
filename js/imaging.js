/**
 * Préparation de la photo avant l'OCR.
 *
 * Une page de livre photographiée au téléphone est rarement plate et bien
 * éclairée : ombre du lecteur, reflet de la lampe, page bombée. Un seuillage
 * *adaptatif* (chaque pixel comparé à la moyenne de son voisinage) encaisse ces
 * variations là où un seuil global transformerait la moitié de la page en noir.
 */

/** Charge un fichier image en quelque chose que le canvas sait dessiner. */
export async function loadImage(file) {
  if (globalThis.createImageBitmap) {
    try { return await createImageBitmap(file); } catch { /* on tente la balise img */ }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Cette image n'a pas pu être ouverte."));
      image.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

const sizeOf = (source) => ({
  width: source.videoWidth || source.naturalWidth || source.width,
  height: source.videoHeight || source.naturalHeight || source.height,
});

/** Redessine la source dans un canvas, sans dépasser `maxSide` sur le grand côté. */
export function toCanvas(source, maxSide = 1600) {
  const { width, height } = sizeOf(source);
  if (!width || !height) throw new Error("L'image est vide.");
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * Seuillage adaptatif (moyenne locale via image intégrale).
 * `offset` : à quel point un pixel doit être plus sombre que son voisinage
 * pour compter comme de l'encre. Plus il est haut, plus on efface le gris.
 */
export function adaptiveThreshold(canvas, { offset = 12 } = {}) {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const { width, height } = canvas;
  const image = context.getImageData(0, 0, width, height);
  const pixels = image.data;

  const gray = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < pixels.length; i += 4, p += 1) {
    gray[p] = (pixels[i] * 299 + pixels[i + 1] * 587 + pixels[i + 2] * 114) / 1000;
  }

  // Image intégrale : somme(0,0 → x,y), pour une moyenne de fenêtre en O(1).
  const integral = new Float64Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y += 1) {
    let rowSum = 0;
    for (let x = 0; x < width; x += 1) {
      rowSum += gray[y * width + x];
      integral[(y + 1) * (width + 1) + (x + 1)] = integral[y * (width + 1) + (x + 1)] + rowSum;
    }
  }

  const radius = Math.max(8, Math.round(Math.min(width, height) / 24));
  for (let y = 0; y < height; y += 1) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(height - 1, y + radius);
    for (let x = 0; x < width; x += 1) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width - 1, x + radius);
      const area = (x1 - x0 + 1) * (y1 - y0 + 1);
      const sum = integral[(y1 + 1) * (width + 1) + (x1 + 1)]
        - integral[y0 * (width + 1) + (x1 + 1)]
        - integral[(y1 + 1) * (width + 1) + x0]
        + integral[y0 * (width + 1) + x0];
      const value = gray[y * width + x] < (sum / area) - offset ? 0 : 255;
      const i = (y * width + x) * 4;
      pixels[i] = value;
      pixels[i + 1] = value;
      pixels[i + 2] = value;
      pixels[i + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);
  return canvas;
}

/** La photo, prête pour l'OCR. */
export function prepareForOcr(source, { enhance = true, maxSide = 1600 } = {}) {
  const canvas = toCanvas(source, maxSide);
  return enhance ? adaptiveThreshold(canvas) : canvas;
}

/** Vignette pour la bibliothèque. */
export function makeThumb(source, size = 360) {
  const canvas = toCanvas(source, size);
  return canvas.toDataURL('image/jpeg', 0.7);
}
