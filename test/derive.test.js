// -----------------------------------------------------------------------------
// What the snapshot means on Wednesday 14 October 2026 at 10:00.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DAYS,
  daySummary,
  gradeLine,
  homeworkShown,
  homeworkUntil,
  lastGrade,
  lessonLine,
  nextLesson,
  nextSchoolDay,
  pendingHomework,
  recentGrades,
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

test('the homework window counts its days from the next school day', () => {
  // A school week: from today, as many days as asked.
  assert.equal(homeworkUntil(lea, NOW, 7), '2026-10-21');
  assert.equal(homeworkUntil(lea, NOW, 1), '2026-10-15');
  assert.deepEqual(
    homeworkShown(lea, NOW, 7).map((item) => [item.subject, item.done]),
    [
      ['MATHEMATIQUES', false],
      ['FRANCAIS', true],
      ['HISTOIRE', false],
    ],
  );
  assert.deepEqual(
    homeworkShown(lea, NOW, 1).map((item) => item.subject),
    ['MATHEMATIQUES', 'FRANCAIS'],
  );
});

test('during the holidays the homework window starts at the return', () => {
  // Monday 19 October, Toussaint holidays: school is back on 2 November.
  const holidays = at(2026, 10, 19, 10);
  const student = {
    lessons: [
      {
        subject: 'PHYSIQUE',
        start: at(2026, 11, 2, 8).toISOString(),
        end: at(2026, 11, 2, 9).toISOString(),
        canceled: false,
      },
    ],
    homework: [
      { subject: 'FRANCAIS', due: at(2026, 11, 2).toISOString(), done: true },
      { subject: 'SCIENCES', due: at(2026, 11, 3).toISOString(), done: false },
      { subject: 'ANGLAIS', due: at(2026, 11, 12).toISOString(), done: false },
    ],
  };
  assert.equal(nextSchoolDay(student, holidays), '2026-11-02');
  assert.equal(homeworkUntil(student, holidays, 7), '2026-11-08');
  assert.deepEqual(
    homeworkShown(student, holidays, 7).map((item) => item.subject),
    ['FRANCAIS', 'SCIENCES'],
  );
  // Without a timetable, the window starts tomorrow.
  assert.equal(homeworkUntil({ ...student, lessons: null }, holidays, 7), '2026-10-26');
});

test('the last grades, the most recent first', () => {
  assert.deepEqual(
    recentGrades(lea, 2).map((grade) => grade.subject),
    ['FRANCAIS', 'MATHEMATIQUES'],
  );
  assert.equal(recentGrades(tom, 5).length, 0);
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
