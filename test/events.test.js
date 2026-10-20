// -----------------------------------------------------------------------------
// "New since the last read", and the scene event data built from it.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareStudent, EVENT_DATA, MAX_PER_KIND } from '../src/pronote/events.js';
import { at, grade } from './helpers/fakePawnote.js';
import { NOW, lea as leaResource } from './helpers/fixtures.js';
import { fixtureSnapshot } from './helpers/snapshot.js';

process.env.LOG_LEVEL ??= 'silent';

async function lea(change = () => {}) {
  const resource = leaResource();
  change(resource);
  return (await fixtureSnapshot([resource])).students[0];
}

test('the first read only remembers', async () => {
  const { seen, news } = compareStudent(undefined, await lea(), NOW);
  assert.deepEqual(news, {});
  assert.equal(seen.grades.length, 3);
  assert.equal(seen.homework.length, 3);
  assert.equal(seen.cancellations.length, 1);
  assert.equal(seen.absences.length, 2);
  assert.equal(seen.observations.length, 2);
});

test('a new note in the correspondence book is news', async () => {
  const { seen } = compareStudent(undefined, await lea(), NOW);
  const next = await lea((resource) => {
    resource.notebook.observations.push({
      id: 'O3',
      date: at(2026, 10, 14, 9),
      opened: false,
      name: 'Travail non fait',
      kind: 1,
      subject: { id: 'MATHS', name: 'MATHEMATIQUES' },
      reason: 'Exercices non faits',
    });
  });
  const { news } = compareStudent(seen, next, NOW);
  assert.equal(news.observations.length, 1);
  assert.deepEqual(EVENT_DATA.observations(news.observations[0]), {
    kind: 'observation',
    title: 'Travail non fait',
    subject: 'MATHEMATIQUES',
    comment: 'Exercices non faits',
    date: '2026-10-14',
  });
});

test('an older memory without the correspondence book only remembers it', async () => {
  // seen.json written before the correspondence book was read.
  const { seen } = compareStudent(undefined, await lea(), NOW);
  delete seen.observations;
  const result = compareStudent(seen, await lea(), NOW);
  assert.equal(result.news.observations, undefined);
  assert.equal(result.seen.observations.length, 2);
});

test('only what appeared since is new', async () => {
  const { seen } = compareStudent(undefined, await lea(), NOW);
  const next = await lea((resource) => {
    resource.grades.grades.push(grade('SVT', 17, at(2026, 10, 14), { comment: 'Très bien' }));
    resource.lessons[2].canceled = true;
  });

  const { news } = compareStudent(seen, next, NOW);

  assert.equal(news.grades.length, 1);
  assert.equal(news.grades[0].subject, 'SVT');
  assert.equal(news.homework.length, 0);
  assert.equal(news.cancellations.length, 1);
  assert.equal(news.cancellations[0].subject, 'MATHEMATIQUES');
  assert.equal(news.absences.length, 0);
});

test('a part that was not read keeps its memory', async () => {
  const { seen } = compareStudent(undefined, await lea(), NOW);
  const failed = { ...(await lea()), grades: null };

  const result = compareStudent(seen, failed, NOW);
  assert.deepEqual(result.seen.grades, seen.grades);
  assert.equal(result.news.grades, undefined);

  // Back: nothing is new.
  assert.equal(compareStudent(result.seen, await lea(), NOW).news.grades.length, 0);
});

test('a canceled lesson already past is not news', async () => {
  const { seen } = compareStudent(undefined, await lea(), NOW);
  const next = await lea((resource) => {
    resource.lessons[0].canceled = true; // 08:00 today, it is 10:00
  });
  assert.equal(compareStudent(seen, next, NOW).news.cancellations.length, 0);
});

test('a flood is capped', async () => {
  const { seen } = compareStudent(undefined, await lea(), NOW);
  const next = await lea((resource) => {
    for (let day = 1; day <= MAX_PER_KIND + 5; day += 1) {
      resource.grades.grades.push(grade('EPS', day, at(2026, 9, day)));
    }
  });
  const result = compareStudent(seen, next, NOW);
  assert.equal(result.news.grades.length, MAX_PER_KIND);
  assert.equal(result.dropped, 5);
});

test('the event data is flat and in the declared shape', async () => {
  const student = await lea();
  const math = student.grades.list[0];
  assert.deepEqual(EVENT_DATA.grades(math), {
    subject: 'MATHEMATIQUES',
    grade: 15,
    out_of: 20,
    grade_20: 15,
    grade_label: '15/20',
    coefficient: 2,
    class_average: 11.5,
    comment: '',
    date: '2026-10-12',
  });
  assert.deepEqual(EVENT_DATA.cancellations(student.lessons[3]), {
    subject: 'PHYSIQUE',
    date: '2026-10-15',
    start_time: '10:00',
    end_time: '11:00',
    status: 'Prof. absent',
  });
  assert.deepEqual(EVENT_DATA.homework(student.homework[0]), {
    subject: 'MATHEMATIQUES',
    description: 'Exercice 3 p. 12',
    due_date: '2026-10-15',
  });
  assert.deepEqual(EVENT_DATA.absences({ ...student.delays[0], type: 'delay' }), {
    kind: 'delay',
    date: '2026-10-06',
    justified: 'no',
    minutes: 10,
    reason: '',
  });
});
