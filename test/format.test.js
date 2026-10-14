// -----------------------------------------------------------------------------
// Dates, HTML and keys.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  contentKey,
  dayKey,
  daysBetween,
  formatPoints,
  iso,
  shortDate,
  startOfDay,
  stripHtml,
  timeOf,
  truncate,
} from '../src/pronote/format.js';
import { at } from './helpers/fakePawnote.js';

test('local days and times', () => {
  const date = at(2026, 3, 5, 8, 7);
  assert.equal(dayKey(date), '2026-03-05');
  assert.equal(timeOf(date), '08:07');
  assert.equal(shortDate(date), '05/03');
  assert.deepEqual(startOfDay(date), at(2026, 3, 5));
  assert.deepEqual(addDays(date, 30), at(2026, 4, 4, 8, 7));
  assert.equal(daysBetween(at(2026, 3, 5, 23), at(2026, 3, 6, 1)), 1);
});

test('iso refuses what is not a date', () => {
  assert.equal(iso('nope'), null);
  assert.equal(iso(new Date(0)), '1970-01-01T00:00:00.000Z');
});

test('stripHtml keeps the text and the line breaks', () => {
  assert.equal(
    stripHtml(
      '<div>Exercice&nbsp;1&#160;:<br/>lire <b>p. 12</b> &amp; 13</div><ul><li>a</li><li>b</li></ul>',
    ),
    'Exercice 1 :\nlire p. 12 & 13\n- a\n- b',
  );
  assert.equal(stripHtml(undefined), '');
  assert.equal(stripHtml('&#x1F600; &unknown;'), '😀 &unknown;');
});

test('truncate and formatPoints', () => {
  assert.equal(truncate('abcdef', 4), 'abc…');
  assert.equal(truncate('abc', 4), 'abc');
  assert.equal(formatPoints(12.345), '12,35');
  assert.equal(formatPoints(null), '');
});

test('contentKey is stable and separates its parts', () => {
  assert.equal(contentKey('a', 'b'), contentKey('a', 'b'));
  assert.notEqual(contentKey('ab', ''), contentKey('a', 'b'));
  assert.equal(contentKey('x').length, 16);
});
