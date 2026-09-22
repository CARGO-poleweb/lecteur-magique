import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestPremiumVoices } from '../js/casting.js';

const VOICES = [
  { id: 'v-narr', name: 'Claire', description: 'calm french narrator', labels: { gender: 'female', age: 'middle_aged', use_case: 'narration' } },
  { id: 'v-ogre', name: 'Bruno', description: 'deep gruff monster voice', labels: { gender: 'male', age: 'middle_aged' } },
  { id: 'v-mamie', name: 'Odette', description: 'warm grandmother', labels: { gender: 'female', age: 'old' } },
  { id: 'v-fille', name: 'Lили', description: 'bright cheerful child', labels: { gender: 'female', age: 'young' } },
  { id: 'v-garcon', name: 'Tom', description: 'young boy bright', labels: { gender: 'male', age: 'young' } },
  { id: 'v-papi', name: 'Henri', description: 'old grandfather warm', labels: { gender: 'male', age: 'old' } },
];

test('attribue chaque timbre à la voix qui lui ressemble', () => {
  const chosen = suggestPremiumVoices(VOICES, {}, ['narrateur', 'ogre', 'mamie', 'papi']);
  assert.equal(chosen.narrateur, 'v-narr');
  assert.equal(chosen.ogre, 'v-ogre');
  assert.equal(chosen.mamie, 'v-mamie');
  assert.equal(chosen.papi, 'v-papi');
});

test('ne donne pas deux fois la même voix tant qu’il en reste', () => {
  const chosen = suggestPremiumVoices(VOICES, {}, ['fillette', 'garcon', 'mamie', 'papi', 'ogre', 'narrateur']);
  const used = Object.values(chosen);
  assert.equal(new Set(used).size, used.length, JSON.stringify(chosen));
});

test('respecte un choix déjà fait à la main', () => {
  const chosen = suggestPremiumVoices(VOICES, { ogre: 'v-mamie' }, ['ogre', 'mamie']);
  assert.equal(chosen.ogre, 'v-mamie');
  assert.notEqual(chosen.mamie, 'v-mamie');
});

test('respecte le genre demandé', () => {
  const chosen = suggestPremiumVoices(VOICES, {}, ['sorciere']);
  const voice = VOICES.find((v) => v.id === chosen.sorciere);
  assert.equal(voice.labels.gender, 'female');
});

test('sans aucune voix, ne propose rien plutôt que n’importe quoi', () => {
  assert.deepEqual(suggestPremiumVoices([], {}, ['ogre']), {});
});
