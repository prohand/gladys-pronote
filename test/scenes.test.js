// -----------------------------------------------------------------------------
// Scene actions, through the fake Gladys as a scene would call them.
// -----------------------------------------------------------------------------

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildDiscoveredDevices } from '../src/devices/index.js';
import { homeworkText } from '../src/capabilities/scenes.js';
import { at, grade } from './helpers/fakePawnote.js';
import { useTemporaryDataDir } from './helpers/dataDir.js';
import { createIntegration } from './helpers/integration.js';

const data = await useTemporaryDataDir();
let current;

beforeEach(async () => {
  await data.reset();
  current = await createIntegration();
});

afterEach(() => current.sync.stop());

const studentId = (index) =>
  buildDiscoveredDevices(current.gladys, current.sync.snapshot)[index + 1].external_id;

test('day_summary tells the next school day of a student', async () => {
  const { gladys, sync } = current;
  await sync.sync();

  const ack = await gladys.fake.sceneAction('day_summary', {
    device: studentId(0),
    day: 'next_school_day',
  });

  assert.equal(ack.success, true);
  assert.deepEqual(ack.data.outputs, {
    found: true,
    date: '2026-10-15',
    student_name: 'DURAND Léa',
    lessons: 2,
    canceled: 1,
    first_lesson: '09:00',
    first_subject: 'MATHEMATIQUES',
    last_lesson_end: '12:00',
    canceled_subjects: 'PHYSIQUE',
    homework: 1,
    homework_text: 'MATHEMATIQUES : Exercice 3 p. 12',
  });
});

test('day_summary on a day without lessons says so', async () => {
  const { gladys, sync } = current;
  await sync.sync();
  const ack = await gladys.fake.sceneAction('day_summary', { device: studentId(1), day: 'today' });
  const outputs = ack.data.outputs;
  assert.equal(outputs.found, false);
  assert.equal(outputs.lessons, 0);
  assert.equal(outputs.first_lesson, '');
});

test('day_summary fails before the first read, and for an unknown device', async () => {
  const { gladys, sync } = current;
  const before = await gladys.fake.sceneAction('day_summary', { device: 'x', day: 'today' });
  assert.equal(before.success, false);
  await sync.sync();
  const unknown = await gladys.fake.sceneAction('day_summary', { device: 'ext:x', day: 'today' });
  assert.equal(unknown.success, false);
});

test('refresh reads PRONOTE but never fires a trigger itself', async () => {
  const { gladys, sync, api } = current;
  await sync.sync();
  api.data.students[0].grades.grades.push(grade('SVT', 17, at(2026, 10, 14)));

  const ack = await gladys.fake.sceneAction('refresh', {});

  assert.deepEqual(ack.data.outputs, { success: true, students: 2 });
  assert.equal(gladys.fake.sceneEvents.length, 0);
});

test('homeworkText puts one homework per line', () => {
  assert.equal(
    homeworkText([
      { subject: 'MATHS', description: 'Ex. 1\nEx. 2' },
      { subject: 'SVT', description: 'Lire' },
    ]),
    'MATHS : Ex. 1 Ex. 2\nSVT : Lire',
  );
});
