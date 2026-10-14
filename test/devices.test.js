// -----------------------------------------------------------------------------
// The devices and states Gladys receives, checked by the SDK's fake Gladys the
// way the host API checks them (categories, types, ids, state shapes).
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { normalizeConfig } from '../src/config.js';
import { buildDiscoveredDevices, buildStates, findStudent } from '../src/devices/index.js';
import { FEATURES } from '../src/devices/student.js';
import { NOW } from './helpers/fixtures.js';
import { fixtureSnapshot } from './helpers/snapshot.js';

process.env.LOG_LEVEL ??= 'silent';
const snapshot = await fixtureSnapshot();
const config = normalizeConfig({});

test('one device for the account and one per student, accepted by Gladys', async () => {
  const gladys = createFakeGladys();
  const devices = buildDiscoveredDevices(gladys, snapshot);
  await gladys.publishDiscoveredDevices(devices);

  assert.deepEqual(
    gladys.fake.discoveredDevices.map((device) => device.name),
    ['PRONOTE messages – DURAND Marie', 'PRONOTE – DURAND Léa', 'PRONOTE – DURAND Tom'],
  );
  for (const device of devices) {
    for (const feature of device.features) {
      assert.equal(typeof feature.min, 'number', `${feature.external_id} min`);
      assert.equal(typeof feature.max, 'number', `${feature.external_id} max`);
      assert.equal(feature.read_only, true);
    }
  }
});

test('the ids depend on the server and the name, not on PRONOTE session ids', async () => {
  const gladys = createFakeGladys();
  const again = await fixtureSnapshot();
  assert.deepEqual(
    buildDiscoveredDevices(gladys, again).map((device) => device.external_id),
    buildDiscoveredDevices(gladys, snapshot).map((device) => device.external_id),
  );
  const elsewhere = { ...snapshot, account: { ...snapshot.account, url: 'https://other/pronote' } };
  assert.notEqual(
    buildDiscoveredDevices(gladys, elsewhere)[1].external_id,
    buildDiscoveredDevices(gladys, snapshot)[1].external_id,
  );
});

test('the states of the fixture week, accepted by Gladys', async () => {
  const gladys = createFakeGladys();
  const states = buildStates(gladys, snapshot, NOW, config);
  await gladys.publishStates(states);

  const lea = findStudent(
    gladys,
    snapshot,
    buildDiscoveredDevices(gladys, snapshot)[1].external_id,
  );
  assert.equal(lea.name, 'DURAND Léa');
  const id = (key) => `${buildDiscoveredDevices(gladys, snapshot)[1].external_id}:${key}`;
  const value = (key) => gladys.fake.lastState(id(key));

  assert.equal(value(FEATURES.AVERAGE), 14.5);
  assert.equal(value(FEATURES.HOMEWORK_PENDING), 2);
  assert.equal(value(FEATURES.HOMEWORK_NEXT_DAY), 1);
  assert.equal(value(FEATURES.ABSENCES), 1);
  assert.equal(value(FEATURES.DELAYS), 1);
  const text = (key) =>
    gladys.fake.states.filter((state) => state.device_feature_external_id === id(key)).at(-1).text;
  assert.equal(text(FEATURES.NEXT_LESSON), '14:00 ANGLAIS (B12)');
  assert.equal(text(FEATURES.NEXT_DAY_START), '09:00');
  assert.equal(text(FEATURES.LAST_GRADE), 'FRANCAIS Abs/20 (13/10)');

  const account = buildDiscoveredDevices(gladys, snapshot)[0];
  assert.equal(gladys.fake.lastState(account.features[0].external_id), 2);
});

test('the homework horizon of the configuration limits the count', () => {
  const gladys = createFakeGladys();
  const short = buildStates(gladys, snapshot, NOW, normalizeConfig({ homework_days: 1 }));
  const pending = short.find((state) =>
    state.device_feature_external_id.endsWith(`:${FEATURES.HOMEWORK_PENDING}`),
  );
  assert.equal(pending.state, 1);
});

test('a part that was not read publishes nothing rather than a zero', () => {
  const gladys = createFakeGladys();
  const partial = {
    ...snapshot,
    account: { ...snapshot.account, unread_messages: null },
    students: [{ ...snapshot.students[0], grades: null, absences: null, delays: null }],
  };
  const keys = buildStates(gladys, partial, NOW, config).map((state) =>
    state.device_feature_external_id.split(':').at(-1),
  );
  assert.ok(!keys.includes(FEATURES.AVERAGE));
  assert.ok(!keys.includes(FEATURES.ABSENCES));
  assert.ok(!keys.includes('unread-messages'));
  assert.ok(keys.includes(FEATURES.HOMEWORK_PENDING));
});

test('an empty id finds the first student, an unknown one none', () => {
  const gladys = createFakeGladys();
  assert.equal(findStudent(gladys, snapshot, '').name, 'DURAND Léa');
  assert.equal(findStudent(gladys, snapshot, 'ext:nope'), null);
  assert.equal(findStudent(gladys, null, ''), null);
});
