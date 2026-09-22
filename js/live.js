/**
 * Surveillance de l'image en direct.
 *
 * On ne peut pas lancer une reconnaissance de texte à chaque image : elle coûte
 * une à trois secondes. En revanche, on peut analyser 6 images par seconde pour
 * répondre à trois questions bon marché :
 *
 *   — le téléphone a-t-il cessé de bouger ?   (différence entre deux images)
 *   — l'image est-elle nette ?                 (variance du laplacien)
 *   — y a-t-il quelque chose d'écrit ?         (proportion de pixels sombres)
 *
 * Quand les trois sont vraies, et seulement là, on déclenche la lecture de la
 * page. Le même signal de mouvement sert ensuite à repérer qu'on a tourné la page.
 *
 * Les fonctions de ce module sont pures : elles se testent sans navigateur.
 */

export const THRESHOLDS = {
  /** Différence moyenne par pixel (0-255) sous laquelle on considère l'appareil immobile. */
  motionStill: 4,
  /** Au-dessus, il s'est passé quelque chose de franc : on a tourné la page. */
  motionTurn: 14,
  /** Variance du laplacien : en dessous, l'image est floue. */
  sharpnessMin: 25,
  /** Proportion de pixels sombres : en dessous, il n'y a rien d'écrit dans le cadre. */
  inkMin: 0.01,
  /** Nombre d'images immobiles consécutives avant de déclencher. */
  steadyFrames: 4,
  /** Au bout de ce nombre d'images immobiles, on tente même si c'est un peu flou. */
  patienceFrames: 30,
};

/** Luminance d'une ImageData, en niveaux de gris. */
export function toGrayscale(pixels, output) {
  const gray = output || new Uint8Array(pixels.length / 4);
  for (let i = 0, p = 0; i < pixels.length; i += 4, p += 1) {
    gray[p] = (pixels[i] * 299 + pixels[i + 1] * 587 + pixels[i + 2] * 114) / 1000;
  }
  return gray;
}

/** À quel point l'image a changé depuis la précédente. */
export function meanAbsDiff(current, previous) {
  if (!previous || previous.length !== current.length) return Infinity;
  let total = 0;
  for (let i = 0; i < current.length; i += 1) total += Math.abs(current[i] - previous[i]);
  return total / current.length;
}

/**
 * Variance du laplacien : mesure classique de netteté. Une image floue n'a pas
 * de transitions franches, donc son laplacien reste proche de zéro partout.
 */
export function laplacianVariance(gray, width, height) {
  if (width < 3 || height < 3) return 0;
  let sum = 0;
  let sumSquares = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      const value = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - width] - gray[i + width];
      sum += value;
      sumSquares += value * value;
      count += 1;
    }
  }
  if (!count) return 0;
  const mean = sum / count;
  return sumSquares / count - mean * mean;
}

/** Proportion de pixels nettement plus sombres que la moyenne : de l'encre. */
export function inkRatio(gray) {
  if (!gray.length) return 0;
  let total = 0;
  for (let i = 0; i < gray.length; i += 1) total += gray[i];
  const threshold = total / gray.length - 28;
  let dark = 0;
  for (let i = 0; i < gray.length; i += 1) if (gray[i] < threshold) dark += 1;
  return dark / gray.length;
}

/**
 * Machine à états qui décide quand lire.
 *
 * `push` renvoie :
 *   'searching' — ça bouge, ou il n'y a rien à lire
 *   'steady'    — immobile, on laisse la mise au point se faire
 *   'ready'     — c'est le moment de reconnaître le texte
 */
export function createWatcher(thresholds = {}) {
  const limits = { ...THRESHOLDS, ...thresholds };
  let steady = 0;
  let needsMotion = false;      // après une lecture, on attend une vraie page tournée

  return {
    get limits() { return limits; },

    push({ motion, sharpness, ink }) {
      if (motion > limits.motionTurn) {
        needsMotion = false;    // page tournée : on redevient attentif
        steady = 0;
        return 'searching';
      }
      if (motion > limits.motionStill) { steady = 0; return 'searching'; }
      if (ink < limits.inkMin) { steady = 0; return 'searching'; }

      steady += 1;
      if (needsMotion) return 'steady';
      if (steady < limits.steadyFrames) return 'steady';
      // Immobile mais flou : on patiente, puis on tente quand même plutôt que
      // de laisser l'enfant devant un écran qui ne se décide jamais.
      if (sharpness < limits.sharpnessMin && steady < limits.patienceFrames) return 'steady';
      return 'ready';
    },

    /** Après une lecture : ne rien redéclencher tant que la page n'a pas bougé. */
    consume() { needsMotion = true; steady = 0; },

    /** Forcer une nouvelle lecture (bouton de secours). */
    arm() { needsMotion = false; steady = limits.steadyFrames; },

    reset() { steady = 0; needsMotion = false; },
  };
}
