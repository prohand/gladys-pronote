// -----------------------------------------------------------------------------
// The language helpers every user-facing message goes through.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LANGUAGES, localeOf, localize, pick } from '../src/i18n.js';

test('the languages are the ones of the Gladys interface, English first', () => {
  assert.deepEqual(LANGUAGES, ['en', 'fr', 'de', 'es']);
});

test('pick falls back to English for a language it has no text for', () => {
  const texts = { en: 'Homework', fr: 'Devoirs', de: 'Hausaufgaben', es: 'Deberes' };
  assert.equal(pick('de', texts), 'Hausaufgaben');
  assert.equal(pick('es', texts), 'Deberes');
  assert.equal(pick('it', texts), 'Homework');
});

test('localize builds one text per language', () => {
  assert.deepEqual(
    localize((language) => `[${language}]`),
    { en: '[en]', fr: '[fr]', de: '[de]', es: '[es]' },
  );
});

test('every language has a locale, English for the others', () => {
  assert.equal(localeOf('de'), 'de-DE');
  assert.equal(localeOf('it'), 'en-GB');
});
