// -----------------------------------------------------------------------------
// From pawnote's objects to the plain snapshot everything else is built on.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  currentPeriod,
  gradeLabel,
  gradePoints,
  readSnapshot,
  toGrade,
  toLesson,
} from '../src/pronote/read.js';
import {
  at,
  createFakePawnote,
  grade,
  pawnoteError,
  schoolPeriods,
} from './helpers/fakePawnote.js';
import { NOW, lea, tom } from './helpers/fixtures.js';

process.env.LOG_LEVEL ??= 'silent';

async function read(students, account = { name: 'DURAND Marie', unread: 3 }) {
  const api = createFakePawnote({ students, account });
  const handle = api.createSessionHandle();
  await api.loginCredentials(handle, {
    url: 'https://x.index-education.net/pronote',
    kind: 7,
    username: 'mdurand',
  });
  return { api, snapshot: await readSnapshot(api, handle, NOW) };
}

test('the current period is the default one when it covers today', () => {
  const { year, term } = schoolPeriods();
  assert.equal(currentPeriod({ defaultPeriod: term, periods: [year, term] }, NOW), term);
});

test('without a usable default, the shortest period covering today wins', () => {
  const { year, term } = schoolPeriods();
  const old = { ...term, id: 'OLD', startDate: at(2025, 9, 1), endDate: at(2025, 12, 1) };
  assert.equal(currentPeriod({ defaultPeriod: old, periods: [year, term] }, NOW), term);
  assert.equal(currentPeriod({ periods: [year] }, NOW), year);
  assert.equal(currentPeriod(undefined, NOW), null);
});

test('grades read as PRONOTE writes them', () => {
  assert.equal(gradePoints({ kind: 0, points: 12.5 }), 12.5);
  assert.equal(gradePoints({ kind: 1, points: 0 }), null);
  assert.equal(gradePoints({ kind: 6, points: 0 }), 0);
  assert.equal(gradeLabel({ kind: 0, points: 12.5 }), '12,5');
  assert.equal(gradeLabel({ kind: 1, points: 0 }), 'Abs');

  const eight = toGrade(grade('ANGLAIS', 8, at(2026, 10, 5), { outOf: 10 }));
  assert.equal(eight.label, '8/10');
  assert.equal(eight.value_20, 16);
});

test('the same grade gets the same key in every session', () => {
  const a = toGrade(grade('MATHS', 15, at(2026, 10, 12)));
  const b = toGrade({ ...grade('MATHS', 15, at(2026, 10, 12)), id: 'another-session-id' });
  assert.equal(a.key, b.key);
});

test('a detention without a title still has a subject', () => {
  const detention = toLesson({
    is: 'detention',
    startDate: at(2026, 10, 14, 16),
    endDate: at(2026, 10, 14, 17),
  });
  assert.equal(detention.subject, 'Retenue');
  assert.equal(detention.kind, 'detention');
});

test('a parent account reads every child, each with their own data', async () => {
  const { api, snapshot } = await read([lea(), tom()]);

  assert.deepEqual(
    snapshot.students.map((student) => student.name),
    ['DURAND Léa', 'DURAND Tom'],
  );
  assert.deepEqual(
    api.calls.filter(([name]) => name === 'gradesOverview').map(([, who]) => who),
    ['DURAND Léa', 'DURAND Tom'],
  );
  assert.equal(snapshot.account.name, 'DURAND Marie');
  assert.equal(snapshot.account.unread_messages, 3);

  const [first] = snapshot.students;
  assert.equal(first.class_name, '3E B');
  assert.equal(first.grades.average, 14.5);
  assert.equal(first.grades.period, 'Trimestre 1');
  assert.equal(first.grades.list.length, 3);
  assert.equal(first.homework[0].description, 'Exercice 3 p. 12');
  assert.equal(first.homework.at(-1).description, 'Réviser la Révolution');
  assert.equal(first.lessons.length, 5);
  assert.equal(first.lessons.filter((entry) => entry.canceled).length, 1);
  assert.equal(first.absences.length, 1);
  assert.equal(first.delays[0].minutes, 10);
});

test('the homework is read three weeks ahead, the timetable eight days', async () => {
  const { api } = await read([lea()]);
  const [, , start, end] = api.calls.find(([name]) => name === 'assignmentsFromIntervals');
  assert.deepEqual(start, at(2026, 10, 14));
  assert.deepEqual(end, at(2026, 11, 4));
  const [, , from, to] = api.calls.find(([name]) => name === 'timetableFromIntervals');
  assert.deepEqual(from, at(2026, 10, 14));
  assert.deepEqual(to, at(2026, 10, 22));
});

test('a tab that fails is null, the others are still read', async () => {
  const api = createFakePawnote({ students: [lea()] });
  api.failures.gradesOverview = 'AccessDeniedError';
  const handle = api.createSessionHandle();
  await api.loginCredentials(handle, { url: 'u', kind: 6, username: 'x' });

  const snapshot = await readSnapshot(api, handle, NOW);

  assert.equal(snapshot.students[0].grades, null);
  assert.equal(snapshot.students[0].homework.length, 3);
  assert.equal(snapshot.account.unread_messages, null, 'no discussions right, no number');
});

test('a tab the school hides is null without a request', async () => {
  const student = lea();
  student.tabs = new Map();
  const { api, snapshot } = await read([student]);
  assert.equal(snapshot.students[0].grades, null);
  assert.equal(snapshot.students[0].absences, null);
  assert.ok(!api.calls.some(([name]) => name === 'gradesOverview'));
});

test('an expired session is not swallowed by a tab', async () => {
  const api = createFakePawnote({ students: [lea()] });
  api.failures.notebook = 'SessionExpiredError';
  const handle = api.createSessionHandle();
  await api.loginCredentials(handle, { url: 'u', kind: 6, username: 'x' });
  await assert.rejects(readSnapshot(api, handle, NOW), { name: 'SessionExpiredError' });
});

test('a suspended IP address stops the read at the first tab', async () => {
  const api = createFakePawnote({ students: [lea(), tom()] });
  api.failures.gradesOverview = 'SuspendedIPError';
  const handle = api.createSessionHandle();
  await api.loginCredentials(handle, { url: 'u', kind: 6, username: 'x' });

  await assert.rejects(readSnapshot(api, handle, NOW), { name: 'SuspendedIPError' });
  assert.equal(api.calls.filter(([name]) => name === 'gradesOverview').length, 1);
  assert.ok(!api.calls.some(([name]) => name === 'assignmentsFromIntervals'));
});

test('pawnoteError builds errors recognized by name', () => {
  assert.equal(pawnoteError('BusyPageError').name, 'BusyPageError');
});
