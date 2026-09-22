import test from 'node:test';
import assert from 'node:assert/strict';
import { laplacianVariance, meanAbsDiff, inkRatio, createWatcher, THRESHOLDS } from '../js/live.js';

const uniform = (size, value) => Uint8Array.from({ length: size * size }, () => value);

function checkerboard(size, step) {
  const gray = new Uint8Array(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      gray[y * size + x] = (Math.floor(x / step) + Math.floor(y / step)) % 2 ? 235 : 20;
    }
  }
  return gray;
}

function blur(gray, size) {
  const out = new Uint8Array(gray.length);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let total = 0;
      let count = 0;
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny < 0 || nx < 0 || ny >= size || nx >= size) continue;
          total += gray[ny * size + nx];
          count += 1;
        }
      }
      out[y * size + x] = total / count;
    }
  }
  return out;
}

test('la netteté distingue une image franche d’une image floue', () => {
  const size = 64;
  const sharp = checkerboard(size, 4);
  const soft = blur(blur(sharp, size), size);
  const sharpScore = laplacianVariance(sharp, size, size);
  const softScore = laplacianVariance(soft, size, size);
  assert.ok(sharpScore > THRESHOLDS.sharpnessMin, `net = ${sharpScore}`);
  assert.ok(softScore < sharpScore / 4, `flou = ${softScore} vs net = ${sharpScore}`);
});

test('une image unie n’est jamais considérée comme nette', () => {
  assert.equal(laplacianVariance(uniform(32, 180), 32, 32), 0);
});

test('le mouvement se mesure entre deux images', () => {
  const a = uniform(16, 100);
  assert.equal(meanAbsDiff(a, a), 0);
  assert.equal(meanAbsDiff(uniform(16, 110), a), 10);
  assert.equal(meanAbsDiff(a, null), Infinity);
});

test('l’encre se repère sur une page écrite, pas sur un mur', () => {
  assert.ok(inkRatio(checkerboard(32, 4)) > THRESHOLDS.inkMin);
  assert.equal(inkRatio(uniform(32, 200)), 0);
});

const STILL_PAGE = { motion: 1, sharpness: 120, ink: 0.2 };

test('déclenche après quelques images immobiles et nettes', () => {
  const watcher = createWatcher();
  const states = Array.from({ length: THRESHOLDS.steadyFrames }, () => watcher.push(STILL_PAGE));
  assert.deepEqual(states.slice(0, -1), Array(THRESHOLDS.steadyFrames - 1).fill('steady'));
  assert.equal(states.at(-1), 'ready');
});

test('ne déclenche pas tant que ça bouge', () => {
  const watcher = createWatcher();
  for (let i = 0; i < 10; i += 1) {
    assert.equal(watcher.push({ ...STILL_PAGE, motion: 8 }), 'searching');
  }
});

test('ne déclenche pas sur un mur blanc', () => {
  const watcher = createWatcher();
  for (let i = 0; i < 10; i += 1) {
    assert.equal(watcher.push({ ...STILL_PAGE, ink: 0 }), 'searching');
  }
});

test('patiente si c’est flou, puis tente quand même', () => {
  const watcher = createWatcher();
  const blurry = { motion: 1, sharpness: 5, ink: 0.2 };
  for (let i = 1; i < THRESHOLDS.patienceFrames; i += 1) {
    assert.equal(watcher.push(blurry), 'steady', `image ${i}`);
  }
  assert.equal(watcher.push(blurry), 'ready');
});

test('ne relit pas la même page tant qu’elle n’a pas été tournée', () => {
  const watcher = createWatcher();
  for (let i = 0; i < THRESHOLDS.steadyFrames; i += 1) watcher.push(STILL_PAGE);
  watcher.consume();

  for (let i = 0; i < 40; i += 1) {
    assert.equal(watcher.push(STILL_PAGE), 'steady', `image ${i} après lecture`);
  }
  // La page tourne…
  assert.equal(watcher.push({ ...STILL_PAGE, motion: 30 }), 'searching');
  const after = Array.from({ length: THRESHOLDS.steadyFrames }, () => watcher.push(STILL_PAGE));
  assert.equal(after.at(-1), 'ready');
});
