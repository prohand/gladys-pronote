// -----------------------------------------------------------------------------
// What the snapshot means on Wednesday 14 October 2026 at 10:00.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DAYS,
  daySummary,
  gradeLine,
  lastGrade,
  lessonLine,
  nextLesson,
  nextSchoolDay,
  pendingHomework,
} from '../src/pronote/derive.js';
import { at } from './helpers/fakePawnote.js';
import { NOW } from './helpers/fixtures.js';
import { fixtureSnapshot } from './helpers/snapshot.js';

process.env.LOG_LEVEL ??= 'silent';
const [lea, tom] = (await fixtureSnapshot()).students;

test('the next lesson is the next one that has not started', () => {
  assert.equal(nextLesson(lea, NOW).subject, 'ANGLAIS');
  assert.equal(lessonLine(nextLesson(lea, NOW), NOW), '14:00 ANGLAIS (B12)');
  // After the last lesson of the day, the date is written.
  const evening = at(2026, 10, 14, 18);
  assert.equal(lessonLine(nextLesson(lea, evening), evening), '15/10 09:00 MATHEMATIQUES (B12)');
  assert.equal(lessonLine(null, NOW), '—');
});

test('the next school day skips the days without lessons', () => {
  assert.equal(nextSchoolDay(lea, NOW), '2026-10-15');
  assert.equal(nextSchoolDay(tom, NOW), '2026-10-16');
  assert.equal(nextSchoolDay(lea, at(2026, 10, 15, 18)), null);
});

test('the homework still to do leaves out what is done', () => {
  assert.deepEqual(
    pendingHomework(lea, NOW).map((item) => item.subject),
    ['MATHEMATIQUES', 'HISTOIRE'],
  );
});

test('the last grade is the most recent one', () => {
  assert.equal(gradeLine(lastGrade(lea)), 'FRANCAIS Abs/20 (13/10)');
  assert.equal(gradeLine(lastGrade(tom)), '—');
});

test('the day summary of the next school day', () => {
  const summary = daySummary(lea, DAYS.NEXT_SCHOOL_DAY, NOW);
  assert.equal(summary.date, '2026-10-15');
  assert.equal(summary.lessons.length, 3);
  assert.equal(summary.held.length, 2);
  assert.equal(summary.canceled[0].subject, 'PHYSIQUE');
  assert.equal(summary.first.subject, 'MATHEMATIQUES');
  assert.equal(summary.last.subject, 'HISTOIRE');
  assert.equal(summary.homework.length, 2);
});

test('today and tomorrow are calendar days', () => {
  assert.equal(daySummary(lea, DAYS.TODAY, NOW).held.length, 2);
  assert.equal(daySummary(lea, DAYS.TOMORROW, NOW).date, '2026-10-15');
  assert.equal(daySummary(tom, DAYS.TOMORROW, NOW).lessons.length, 0);
  assert.equal(daySummary(lea, DAYS.NEXT_SCHOOL_DAY, at(2026, 10, 15, 18)).date, '');
});
