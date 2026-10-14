// -----------------------------------------------------------------------------
// Dashboard widgets: every content renders exactly as sent (the SDK's own
// validator answers []), in every language and in every state.
// -----------------------------------------------------------------------------

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { buildDiscoveredDevices } from '../src/devices/index.js';
import { LANGUAGES } from '../src/i18n.js';
import { at } from './helpers/fakePawnote.js';
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
    list.items.map((item) => item.title),
    ['MATHEMATIQUES', 'HISTOIRE'],
  );
  assert.equal(list.items[0].badge.color, 'warning', 'due tomorrow');
  const status = components.find((component) => component.type === 'status');
  assert.equal(status.items[0].value, '14:00 ANGLAIS (B12)');
  assert.ok(components.some((component) => component.type === 'button'));
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
