import test from 'node:test';
import assert from 'node:assert/strict';
import { analyseText, findAttribution, characterKey } from '../js/dialogue.js';

const speakers = (text) => analyseText(text).segments
  .filter((s) => s.kind === 'dialogue')
  .map((s) => s.speakerName);

test('attribue une réplique grâce à son incise', () => {
  assert.deepEqual(speakers('— Bonjour, dit le loup.'), ['Le loup']);
});

test('attribue une réplique entre guillemets', () => {
  assert.deepEqual(speakers('« J’ai faim ! » cria l’ogre.'), ['L’ogre']);
});

test('reconnaît le locuteur placé avant le verbe', () => {
  assert.deepEqual(speakers('Léa demanda : « Où est mon doudou ? »'), ['Léa']);
});

test('résout le pronom d’une incise', () => {
  const out = speakers('— Bonjour, dit la sorcière.\n\n— Je m’en vais, ajouta-t-elle.');
  assert.deepEqual(out, ['La sorcière', 'La sorcière']);
});

test('fait alterner deux répliques qui se répondent', () => {
  const text = [
    '— Tu viens ? demanda Léa.',
    '— Non, répondit Tom.',
    '— Pourquoi ?',
    '— Parce que j’ai peur.',
  ].join('\n\n');
  assert.deepEqual(speakers(text), ['Léa', 'Tom', 'Léa', 'Tom']);
});

test('ne prend pas un verbe de parole dans la réplique pour une incise', () => {
  const { segments } = analyseText('— Il dit toujours n’importe quoi !');
  assert.equal(segments.length, 1);
  assert.equal(segments[0].kind, 'dialogue');
  assert.equal(segments[0].text, 'Il dit toujours n’importe quoi !');
});

test('coupe la réplique autour de l’incise et rend l’incise au narrateur', () => {
  const { segments } = analyseText('— Bonjour, dit le loup, je suis affamé.');
  assert.deepEqual(
    segments.map((s) => [s.kind, s.text]),
    [
      ['dialogue', 'Bonjour,'],
      ['narration', 'dit le loup,'],
      ['dialogue', 'je suis affamé.'],
    ],
  );
  assert.equal(segments[2].speakerName, 'Le loup');
});

test('fusionne « le petit lapin » et « le lapin »', () => {
  const { characters } = analyseText(
    '— Bonjour, dit le petit lapin.\n\n— Au revoir, répondit le lapin.',
  );
  assert.equal(characters.length, 1);
  assert.equal(characters[0].count, 2);
});

test('un paragraphe purement narratif ne crée aucun personnage', () => {
  const { segments, characters } = analyseText(
    'Le loup dit à Léa qu’il avait très faim ce matin-là.',
  );
  assert.equal(characters.length, 0);
  assert.equal(segments[0].kind, 'narration');
});

test('devine le genre pour choisir une voix cohérente', () => {
  const { characters } = analyseText('— Bonjour, dit la sorcière.\n\n— Salut, dit le géant.');
  const byName = Object.fromEntries(characters.map((c) => [c.name, c.gender]));
  assert.equal(byName['La sorcière'], 'f');
  assert.equal(byName['Le géant'], 'm');
});

test('nomme les voix inconnues pour qu’on puisse les corriger', () => {
  const { characters } = analyseText('— Qui est là ?\n\n— C’est moi !');
  assert.deepEqual(characters.map((c) => c.name), ['Voix 1', 'Voix 2']);
});

test('ignore les faux noms propres en tête de phrase', () => {
  // « Alors » ouvre la phrase mais ne parle pas : c'est « le loup » qu'on veut.
  assert.equal(findAttribution('Alors dit le loup').name, 'Le loup');
  // Sans autre candidat, un adverbe capitalisé ne devient pas un personnage.
  assert.equal(findAttribution('Enfin dit :'), null);
  assert.equal(findAttribution('Soudain, Léa cria').name, 'Léa');
});

test('la clé de personnage ignore casse, accents et déterminant', () => {
  assert.equal(characterKey('Le Loup'), 'loup');
  assert.equal(characterKey('la Sorcière'), 'sorciere');
  assert.equal(characterKey('L’ogre'), 'ogre');
});

test('dans un échange, « dit-il » désigne celui qui prend la parole', () => {
  const text = [
    '— Bonjour, dit le loup.',
    '— Je ne suis pas seul ! répondit le lapin.',
    '— Ah bon ? Et qui est avec toi ?',
    '— Ma maman, dit-il fièrement.',
  ].join('\n\n');
  assert.deepEqual(speakers(text), ['Le loup', 'Le lapin', 'Le loup', 'Le lapin']);
});

test('un verbe de continuation garde le même locuteur', () => {
  const text = [
    '— Bonjour, dit Léa.',
    '— Tu viens avec moi ? ajouta-t-elle.',
  ].join('\n\n');
  assert.deepEqual(speakers(text), ['Léa', 'Léa']);
});

test('retrouve un personnage nommé dans la narration précédente', () => {
  const text = [
    '— Bonjour, dit le loup.',
    '— Salut, répondit le lapin.',
    'La sorcière, cachée derrière un arbre, éclata de rire.',
    '— Personne n’échappe à ma potion ! s’écria-t-elle.',
  ].join('\n\n');
  assert.deepEqual(speakers(text), ['Le loup', 'Le lapin', 'La sorcière']);
});

test('un décor ne devient pas un personnage', () => {
  const text = [
    'Le vent soufflait derrière un arbre, au fond du jardin.',
    '— J’ai froid, dit-il.',
  ].join('\n\n');
  const { characters } = analyseText(text);
  assert.ok(!characters.some((c) => /arbre|jardin|vent/i.test(c.name)), `personnages : ${characters.map((c) => c.name)}`);
});
