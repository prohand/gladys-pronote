// -----------------------------------------------------------------------------
// The read loop end to end: fake PRONOTE in, fake Gladys out.
// -----------------------------------------------------------------------------

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { SEEN_FILE } from '../src/sync.js';
import { readJson } from '../src/storage.js';
import { at, grade, homework } from './helpers/fakePawnote.js';
import { useTemporaryDataDir } from './helpers/dataDir.js';
import { createIntegration } from './helpers/integration.js';

const data = await useTemporaryDataDir();
let running = [];

beforeEach(async () => {
  await data.reset();
});

afterEach(() => {
  for (const sync of running) {
    sync.stop();
  }
  running = [];
});

async function integration(options) {
  const result = await createIntegration(options);
  running.push(result.sync);
  return result;
}

test('a read publishes the devices, the states, the badge and the status', async () => {
  const { gladys, sync } = await integration();
  const result = await sync.sync();

  assert.equal(result.ok, true);
  assert.equal(gladys.fake.discoveredDevices.length, 3);
  assert.ok(gladys.fake.states.length > 10);
  assert.deepEqual(
    gladys.fake.transports.map((entry) => entry.transport),
    ['cloud', 'cloud', 'cloud'],
  );
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.ok(gladys.fake.widgetRefreshes.includes('student'));
  assert.ok(gladys.fake.widgetRefreshes.includes('timetable'));
});

test('the devices are published again only when the students change', async () => {
  const { gladys, sync, api } = await integration();
  await sync.sync();
  await sync.sync();
  const publications = () =>
    gladys.fake.requests.filter((request) => request.path.includes('discover')).length;
  assert.equal(publications(), 1);

  api.data.students.pop();
  await sync.sync();
  assert.equal(publications(), 2);
});

test('unchanged states are not sent again', async () => {
  const { gladys, sync } = await integration();
  await sync.sync();
  const count = gladys.fake.states.length;
  await sync.sync();
  assert.equal(gladys.fake.states.length, count);
});

test('the first read announces nothing, the next ones what is new', async () => {
  const { gladys, sync, api } = await integration();
  await sync.sync();
  assert.equal(gladys.fake.sceneEvents.length, 0);
  assert.ok(await readJson(SEEN_FILE));

  const [lea] = api.data.students;
  lea.grades.grades.push(grade('SVT', 17, at(2026, 10, 14)));
  lea.homework.push(homework('ANGLAIS', 'Vocabulaire', at(2026, 10, 16)));
  const result = await sync.sync();

  assert.equal(result.events, 2);
  const [newGrade, newHomework] = gladys.fake.sceneEvents;
  assert.equal(newGrade.key, 'new_grade');
  assert.equal(newGrade.data.student_name, 'DURAND Léa');
  assert.equal(newGrade.data.subject, 'SVT');
  assert.equal(newGrade.data.grade, 17);
  assert.match(newGrade.data.device, /^ext:test-integration:student:/);
  assert.equal(newHomework.key, 'new_homework');
  assert.equal(newHomework.data.due_date, '2026-10-16');
});

test('what was announced stays announced after a restart', async () => {
  const first = await integration();
  await first.sync.sync();
  first.api.data.students[0].grades.grades.push(grade('SVT', 17, at(2026, 10, 14)));
  await first.sync.sync();

  const second = await integration({ students: first.api.data.students });
  await second.sync.sync();
  assert.equal(second.gladys.fake.sceneEvents.length, 0);
});

test('a read without events leaves the news to the next one', async () => {
  const { gladys, sync, api } = await integration();
  await sync.sync();
  api.data.students[0].grades.grades.push(grade('SVT', 17, at(2026, 10, 14)));

  await sync.sync({ fireEvents: false });
  assert.equal(gladys.fake.sceneEvents.length, 0);
  await sync.sync();
  assert.equal(gladys.fake.sceneEvents.length, 1);
});

test('a failed read keeps the last snapshot and says why', async () => {
  const { gladys, sync, api } = await integration();
  await sync.sync();
  api.failures.loginToken = 'BusyPageError';
  sync.session.drop();

  const result = await sync.sync();

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'unavailable');
  assert.equal(sync.snapshot.students.length, 2);
  assert.deepEqual(
    gladys.fake.transports.slice(-3).map((entry) => entry.transport),
    ['unreachable', 'unreachable', 'unreachable'],
  );
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.fr, /injoignable/);
});

test('a refused password pauses the loop instead of retrying it', async () => {
  const { sync, api } = await integration();
  api.failures.loginCredentials = 'BadCredentialsError';

  const result = await sync.restart();

  assert.equal(result.error.code, 'bad_credentials');
  assert.equal(sync.timer, null);
});

test('a failure that can pass keeps the loop going', async () => {
  const { sync, api } = await integration();
  api.failures.loginCredentials = 'BusyPageError';
  await sync.restart();
  assert.notEqual(sync.timer, null);
});

test('a suspended IP address is a failed read, and nobody but the timer asks again', async () => {
  const { gladys, sync, api, clock } = await integration();
  await sync.sync();
  api.failures.assignmentsFromIntervals = 'SuspendedIPError';

  const result = await sync.sync();
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'suspended_ip');
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.fr, /suspendu/);
  assert.equal(sync.snapshot.students.length, 2, 'the last snapshot stays');

  // The widget button and the scene action do not call PRONOTE again.
  const calls = api.calls.length;
  const again = await sync.sync({ fireEvents: false });
  assert.equal(again.ok, false);
  assert.equal(again.error.code, 'suspended_ip');
  assert.equal(api.calls.length, calls);

  // The Configuration screen buttons still try.
  const forced = await sync.restart();
  assert.equal(forced.error.code, 'suspended_ip');
  assert.ok(api.calls.length > calls);

  // An hour later, a refresh reads again.
  delete api.failures.assignmentsFromIntervals;
  clock.now = new Date(clock.now.getTime() + 61 * 60 * 1000);
  assert.equal((await sync.sync({ fireEvents: false })).ok, true);
});

test('a session PRONOTE closes right after the login is one login, then an hour of rest', async () => {
  const { gladys, sync, api } = await integration();
  // What a PRONOTE 2026.2 server did to a parent account: the grades refused,
  // then the session gone.
  api.failures.gradesOverview = 'AccessDeniedError';
  api.failures.assignmentsFromIntervals = 'SessionExpiredError';

  const result = await sync.restart();
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'session_closed');
  assert.match(gladys.fake.connectionStatus.message.fr, /fermé la session/);
  const logins = api.calls.filter(([name]) => name.startsWith('login'));
  assert.equal(logins.length, 1, 'no second login at once');

  const calls = api.calls.length;
  assert.equal((await sync.sync({ fireEvents: false })).error.code, 'session_closed');
  assert.equal(api.calls.length, calls, 'the widget button waits too');
});

test('two reads at once are one read', async () => {
  const { sync, api } = await integration();
  await Promise.all([sync.sync(), sync.sync()]);
  assert.equal(api.calls.filter(([name]) => name === 'gradesOverview').length, 2);
});

test('a Gladys that refuses the devices does not break the read', async () => {
  const { gladys, sync } = await integration();
  gladys.publishDiscoveredDevices = async () => {
    throw new Error('429');
  };
  const result = await sync.sync();
  assert.equal(result.ok, true);
  assert.ok(gladys.fake.states.length > 0);
});

test('a stopped loop is not armed again by a read under way', async () => {
  const { sync } = await integration();
  await sync.restart();
  assert.notEqual(sync.timer, null);
  sync.stop();
  sync.schedule({ ok: true });
  assert.equal(sync.timer, null);
});
