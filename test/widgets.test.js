// -----------------------------------------------------------------------------
// Dashboard widgets: every content renders exactly as sent (the SDK's own
// validator answers []), in every language and in every state.
// -----------------------------------------------------------------------------

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { buildDiscoveredDevices } from '../src/devices/index.js';
import { LANGUAGES } from '../src/i18n.js';
import { at, homework, lesson, studentResource } from './helpers/fakePawnote.js';
import { useTemporaryDataDir } from './helpers/dataDir.js';
import { createIntegration } from './helpers/integration.js';

const data = await useTemporaryDataDir();
let current;

beforeEach(async () => {
  await data.reset();
  current = await createIntegration();
});

afterEach(() => current.sync.stop());

async function content(key, settings = {}, language = 'fr') {
  const ack = await current.gladys.fake.widgetGet(key, { settings, language, units: 'metric' });
  assert.equal(ack.success, true, ack.error);
  assert.deepEqual(validateWidgetContent(ack.data.content), [], `${key} ${language}`);
  return ack.data.content;
}

const studentId = (index) =>
  buildDiscoveredDevices(current.gladys, current.sync.snapshot)[index + 1].external_id;

test('before the first read, both widgets say they wait', async () => {
  for (const key of ['student', 'timetable']) {
    const { components } = await content(key);
    assert.equal(components[0].type, 'text');
    assert.match(components[0].text.fr, /première lecture/);
  }
});

test('a failed first read shows why', async () => {
  current.api.failures.loginCredentials = 'BadCredentialsError';
  await current.sync.sync();
  const { components } = await content('student');
  assert.equal(components[1].type, 'status');
  assert.equal(components[1].items[0].color, 'danger');
});

test('the student widget, in every language', async () => {
  await current.sync.sync();
  for (const language of LANGUAGES) {
    await content('student', {}, language);
    await content('student', { student: studentId(1) }, language);
  }
  const { components } = await content('student', { student: studentId(0) });
  const tiles = components.filter((component) => component.type === 'value');
  assert.deepEqual(
    tiles.map((tile) => tile.value),
    ['14,5', 2, 1],
  );
  const list = components.find((component) => component.type === 'card-list');
  assert.deepEqual(
    list.items.map((item) => [item.title, item.badge.text]),
    [
      ['MATHEMATIQUES', 'Demain'],
      ['FRANCAIS', 'Fait'],
      ['HISTOIRE', 'Non fait'],
    ],
  );
  assert.equal(list.items[0].badge.color, 'warning', 'due tomorrow');
  assert.equal(list.items[1].badge.color, 'success', 'done');
  const status = components.find((component) => component.type === 'status');
  assert.equal(status.items[0].value, '14:00 ANGLAIS (B12)');
  assert.ok(components.some((component) => component.type === 'button'));
});

test('the student widget lists the last grades or the correspondence book', async () => {
  await current.sync.sync();
  for (const language of LANGUAGES) {
    for (const list of ['homework', 'grades', 'notebook']) {
      await content('student', { student: studentId(0), list }, language);
      await content('student', { student: studentId(1), list }, language);
    }
  }
  const focal = async (settings) =>
    (await content('student', settings, 'fr')).components.find(
      (component) => component.type === 'card-list' || component.variant === 'caption',
    );

  const grades = await focal({ student: studentId(0), list: 'grades' });
  assert.deepEqual(
    grades.items.map((item) => [item.title, item.badge.text]),
    [
      ['FRANCAIS', 'Abs/20'],
      ['MATHEMATIQUES', '15/20'],
      ['ANGLAIS', '8/10'],
    ],
  );
  assert.equal(grades.items[1].badge.color, 'success');
  assert.match(grades.items[1].subtitle, /Classe 11,5/);

  const notebook = await focal({ student: studentId(0), list: 'notebook' });
  assert.deepEqual(
    notebook.items.map((item) => [item.title, item.badge.text]),
    [
      ['Encouragements', 'Encouragement'],
      ['Oubli de matériel', 'Défaut carnet'],
    ],
  );
  assert.equal(notebook.items[1].description, 'Pas de blouse');

  assert.match((await focal({ student: studentId(1), list: 'grades' })).text.fr, /Aucune note/);
  assert.match((await focal({ student: studentId(1), list: 'notebook' })).text.fr, /Aucun mot/);
});

test('the timetable widget flags canceled lessons and tests', async () => {
  await current.sync.sync();
  for (const language of LANGUAGES) {
    for (const day of ['today', 'tomorrow', 'next_school_day']) {
      await content('timetable', { student: studentId(0), day }, language);
      await content('timetable', { student: studentId(1), day }, language);
    }
  }
  const { components } = await content('timetable', { student: studentId(0) }, 'en');
  assert.match(components[0].text, /Thursday 15 October/);
  const list = components.find((component) => component.type === 'card-list');
  assert.deepEqual(
    list.items.map((item) => item.badge?.text ?? null),
    [null, 'Canceled', 'Test'],
  );
  assert.equal(list.items[0].title, '09:00–10:00 MATHEMATIQUES');
});

test('during the holidays, both widgets look at the return', async () => {
  // Tuesday 20 October, Toussaint holidays: PRONOTE shows the homework and the
  // lessons of Monday 2 November, the widgets did not look that far.
  current.sync.stop();
  current = await createIntegration({
    students: [
      studentResource('S1', 'DURAND Léa', {
        homework: [
          homework('FRANCAIS', 'Lire', at(2026, 11, 2), true),
          homework('SCIENCES', 'Apprendre chapitres 1 et 2', at(2026, 11, 3)),
        ],
        lessons: [
          lesson('PHYSIQUE-CHIMIE', at(2026, 11, 2, 8), at(2026, 11, 2, 10)),
          lesson('ANGLAIS', at(2026, 11, 2, 14), at(2026, 11, 2, 15)),
        ],
      }),
    ],
  });
  current.clock.now = at(2026, 10, 20, 16);
  await current.sync.sync();

  const student = (await content('student')).components;
  assert.equal(student.find((component) => component.label?.fr === 'Devoirs').value, 1);
  const list = student.find((component) => component.type === 'card-list');
  assert.deepEqual(
    list.items.map((item) => [item.title, item.badge.text]),
    [
      ['FRANCAIS', 'Fait'],
      ['SCIENCES', 'Non fait'],
    ],
  );

  const timetable = (await content('timetable', {}, 'fr')).components;
  assert.match(timetable[0].text, /lundi 2 novembre/);
  assert.equal(timetable.find((component) => component.type === 'card-list').items.length, 2);
});

test('an unknown student says so', async () => {
  await current.sync.sync();
  const { components } = await content('student', { student: 'ext:gone' });
  assert.match(components[0].text.en, /not on the PRONOTE account/);
});

test('no school day in the week is said as such', async () => {
  await current.sync.sync();
  current.clock.now = at(2026, 10, 16, 18);
  const { components } = await content('timetable', { student: studentId(0) });
  assert.match(components[1].text.fr, /Pas de jour de cours/);
});

test('the refresh button reads PRONOTE again', async () => {
  await current.sync.sync();
  const ack = await current.gladys.fake.widgetAction('student', 'refresh', {}, { settings: {} });
  assert.equal(ack.success, true);
  assert.match(ack.data.message.fr, /relu/);
  const unknown = await current.gladys.fake.widgetAction('student', 'nope', {}, { settings: {} });
  assert.equal(unknown.success, false);
});
