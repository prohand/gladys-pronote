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

const KEYS = ['student', 'timetable', 'homework', 'grades', 'notebook'];

test('before the first read, every widget says it waits', async () => {
  for (const key of KEYS) {
    const { components } = await content(key);
    assert.equal(components[0].type, 'text');
    assert.match(components[0].text.fr, /première lecture/);
  }
});

test('a failed first read shows why', async () => {
  current.api.failures.loginCredentials = 'BadCredentialsError';
  await current.sync.sync();
  for (const key of KEYS) {
    const { components } = await content(key);
    assert.equal(components[1].type, 'status');
    assert.equal(components[1].items[0].color, 'danger');
  }
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
  assert.ok(!components.some((component) => component.type === 'card-list'), 'no list by default');
  const status = components.find((component) => component.type === 'status');
  assert.equal(status.items[0].value, '14:00 ANGLAIS (B12)');
  assert.equal(status.items[1].label.fr, 'Prochain jour de cours', 'a lesson is left today');
  assert.ok(components.some((component) => component.type === 'button'));

  const list = (
    await content('student', { student: studentId(0), list: 'homework' })
  ).components.find((component) => component.type === 'card-list');
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
});

test('the one-list widgets show the student, one tile and the list', async () => {
  await current.sync.sync();
  for (const language of LANGUAGES) {
    for (const key of ['homework', 'grades', 'notebook']) {
      await content(key, { student: studentId(0) }, language);
      await content(key, { student: studentId(1) }, language);
    }
  }
  const parts = async (key) => {
    const { components } = await content(key, { student: studentId(0) });
    assert.ok(!components.some((component) => component.type === 'button'), key);
    return {
      heading: components[0].text,
      tiles: components.filter((component) => component.type === 'value'),
      list: components.find((component) => component.type === 'card-list'),
    };
  };

  const homework = await parts('homework');
  assert.match(homework.heading, /· Devoirs$/);
  assert.deepEqual(
    homework.tiles.map((tile) => [tile.label.fr, tile.value]),
    [['À faire', 2]],
  );
  assert.equal(homework.list.items.length, 3);

  const grades = await parts('grades');
  assert.match(grades.heading, /· Dernières notes$/);
  assert.deepEqual(
    grades.tiles.map((tile) => tile.value),
    ['14,5'],
  );
  assert.equal(grades.list.items[1].badge.text, '15/20');

  const notebook = await parts('notebook');
  assert.match(notebook.heading, /· Carnet de correspondance$/);
  assert.deepEqual(notebook.tiles, []);
  assert.equal(notebook.list.items.length, 2);
});

test('a part PRONOTE did not give is said unavailable', async () => {
  current.api.failures.gradesOverview = 'AccessDeniedError';
  await current.sync.sync();
  const { components } = await content('grades', { student: studentId(0) });
  assert.match(components[1].text.fr, /Indisponible/);
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

test('the grades widget shows as many grades as its setting says', async () => {
  await current.sync.sync();
  const list = async (count) =>
    (await content('grades', { student: studentId(0), count })).components.find(
      (component) => component.type === 'card-list',
    );
  assert.deepEqual(
    (await list(1)).items.map((item) => item.title),
    ['FRANCAIS'],
  );
  assert.equal((await list(2)).items.length, 2);
  // Unset (an instance saved before the setting), or out of bounds: the default.
  assert.equal((await list(undefined)).items.length, 3);
  assert.equal((await list(0)).items.length, 3);
  assert.equal((await list(50)).items.length, 3);
});

test('the timetable widget over several days, one row a day', async () => {
  await current.sync.sync();
  for (const language of LANGUAGES) {
    for (const day of ['today', 'tomorrow', 'next_school_day']) {
      await content('timetable', { student: studentId(0), day, days: 8 }, language);
      await content('timetable', { student: studentId(1), day, days: 3 }, language);
    }
  }
  const { components } = await content(
    'timetable',
    { student: studentId(0), day: 'today', days: 8 },
    'fr',
  );
  assert.equal(components[0].text, 'DURAND · mer. 14/10 → mer. 21/10');
  assert.deepEqual(
    components.filter((component) => component.type === 'value').map((tile) => tile.value),
    [4, 1, 1],
  );
  const list = components.find((component) => component.type === 'card-list');
  assert.deepEqual(
    list.items.map((item) => [item.title, item.subtitle, item.badge?.text ?? null]),
    [
      ['mer. 14/10 · 08:00–15:00', 'MATHEMATIQUES, ANGLAIS', null],
      ['jeu. 15/10 · 09:00–12:00', 'MATHEMATIQUES, HISTOIRE', 'Annulé'],
    ],
  );
  assert.equal(
    list.items[1].description,
    '09:00–10:00 MATHEMATIQUES (B12)\n10:00–11:00 PHYSIQUE (B12) · Annulé\n' +
      '11:00–12:00 HISTOIRE (B12) · Contrôle',
  );
  // Tom has no lesson on the weekend that follows his Friday.
  const tom = await content('timetable', { student: studentId(1), day: 'tomorrow', days: 2 });
  assert.deepEqual(
    tom.components.find((component) => component.type === 'card-list').items.length,
    1,
  );
  current.clock.now = at(2026, 10, 17, 9); // Saturday: the weekend, then nothing read
  const empty = await content('timetable', { student: studentId(1), day: 'today', days: 3 });
  assert.match(empty.components[1].text.fr, /Pas de cours sur cette période/);
});

test('shifted timetable widgets make one column a day', async () => {
  await current.sync.sync();
  for (const language of LANGUAGES) {
    await content('timetable', { student: studentId(0), day: 'today', shift: 1 }, language);
    await content('timetable', { student: studentId(0), day: 'today', shift: 2 }, language);
  }
  const column = async (shift) =>
    (await content('timetable', { student: studentId(0), day: 'today', shift }, 'fr')).components;
  assert.match((await column(0))[0].text, /mercredi 14 octobre/);
  assert.match((await column(1))[0].text, /jeudi 15 octobre/);
  // Unset (an instance saved before the setting), or out of bounds: no shift.
  assert.match((await column(undefined))[0].text, /mercredi 14 octobre/);
  assert.match((await column(-3))[0].text, /mercredi 14 octobre/);
  // Léa has no lesson read after Thursday.
  assert.match((await column(2))[1].text.fr, /pas encore dans l’emploi du temps/);
  const period = await content(
    'timetable',
    { student: studentId(0), day: 'today', days: 3, shift: 1 },
    'fr',
  );
  assert.equal(period.components[0].text, 'DURAND · jeu. 15/10 → sam. 17/10');
});

test('during the holidays, the widgets look at the return', async () => {
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
  const status = student.find((component) => component.type === 'status');
  assert.match(status.items[0].value, /02\/11 08:00 PHYSIQUE-CHIMIE/);
  assert.notEqual(status.items[1].label.fr, 'Prochain jour de cours', 'said once, not twice');
  const list = (await content('homework')).components.find(
    (component) => component.type === 'card-list',
  );
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
