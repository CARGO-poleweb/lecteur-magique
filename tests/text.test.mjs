import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanOcrText, splitSentences, toParagraphs, looksEmpty, textSimilarity } from '../js/text.js';

test('recolle les lignes d’un même paragraphe', () => {
  const ocr = 'Il était une fois une petite fille qui\nvivait au bord de la grande forêt\nsombre.';
  assert.equal(cleanOcrText(ocr), 'Il était une fois une petite fille qui vivait au bord de la grande forêt sombre.');
});

test('répare les césures de fin de ligne', () => {
  const ocr = 'La sorcière préparait une potion extra-\nordinaire dans son chaudron.';
  assert.match(cleanOcrText(ocr), /extraordinaire/);
});

test('garde le trait d’union d’un vrai mot composé', () => {
  const ocr = 'Elle appela sa grand-\nmère au téléphone.';
  assert.match(cleanOcrText(ocr), /grand-?mère/);
});

test('jette les numéros de page et les traits de séparation', () => {
  const ocr = 'Le loup avait très faim.\n\n12\n\n— — —\n\nIl partit chasser.';
  const out = cleanOcrText(ocr);
  assert.doesNotMatch(out, /12/);
  assert.match(out, /Le loup avait très faim\./);
  assert.match(out, /Il partit chasser\./);
});

test('ouvre un paragraphe à chaque réplique', () => {
  const ocr = 'Le loup arriva.\n— Bonjour !\n— Bonsoir !';
  assert.equal(toParagraphs(cleanOcrText(ocr)).length, 3);
});

test('normalise les guillemets et la ponctuation française', () => {
  const out = cleanOcrText('<<Bonjour>> dit-elle . Puis elle partit !');
  assert.match(out, /« Bonjour »/);
  assert.match(out, /partit !/);
  assert.doesNotMatch(out, / \./);
});

test('remplace les points de suspension et les tirets doubles', () => {
  const out = cleanOcrText('Euh... je ne sais pas -- vraiment pas.');
  assert.match(out, /Euh…/);
  assert.match(out, /—/);
});

test('découpe en phrases sans se tromper sur les abréviations', () => {
  const phrases = splitSentences('M. Renard arriva. Il salua Mme Poule. Puis il repartit !');
  assert.deepEqual(phrases, ['M. Renard arriva.', 'Il salua Mme Poule.', 'Puis il repartit !']);
});

test('ne coupe pas sur des points de suspension en milieu de phrase', () => {
  assert.deepEqual(splitSentences('Euh… je crois que oui.'), ['Euh… je crois que oui.']);
});

test('garde les guillemets fermants avec leur phrase', () => {
  assert.deepEqual(
    splitSentences('« Viens ici ! » Le chat s’enfuit.'),
    ['« Viens ici ! »', 'Le chat s’enfuit.'],
  );
});

test('repère une page illisible', () => {
  assert.equal(looksEmpty('~~ |\\ ° ~'), true);
  assert.equal(looksEmpty('Le loup avait faim.'), false);
});

test('ne coupe pas un paragraphe sur une ligne vide au milieu d’une phrase', () => {
  const ocr = '— Je ne suis pas seul ! répondit\n\nle lapin en riant très fort.';
  assert.equal(toParagraphs(cleanOcrText(ocr)).length, 1);
});

test('respecte une ligne vide entre deux phrases terminées', () => {
  const ocr = 'Le loup avait très faim.\n\nIl partit chasser dans la forêt.';
  assert.equal(toParagraphs(cleanOcrText(ocr)).length, 2);
});

test('reconnaît qu’il s’agit toujours de la même page', () => {
  const page = 'Le petit lapin vivait au bord de la grande forêt sombre et profonde.';
  const rescan = 'Le petit Iapin vivait au bord de la grande forêt sombre et profonde';
  assert.ok(textSimilarity(page, rescan) > 0.7, textSimilarity(page, rescan));
  assert.ok(textSimilarity(page, 'La sorcière préparait une potion verte dans son chaudron.') < 0.3);
  assert.equal(textSimilarity('', ''), 1);
});
