// -----------------------------------------------------------------------------
// The buttons of the Configuration screen.
// -----------------------------------------------------------------------------

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { SESSION_FILE } from '../src/pronote/session.js';
import { readJson } from '../src/storage.js';
import { useTemporaryDataDir } from './helpers/dataDir.js';
import { createIntegration } from './helpers/integration.js';
import { LANGUAGES } from '../src/i18n.js';

const data = await useTemporaryDataDir();
let current;

beforeEach(async () => {
  await data.reset();
});

afterEach(() => current?.sync.stop());

const QR = JSON.stringify({
  jeton: 'ABC',
  login: 'DEF',
  url: 'https://0123456a.index-education.net/pronote/mobile.eleve.html',
});

test('test_connection says what it found, in every language', async () => {
  current = await createIntegration();
  const ack = await current.gladys.fake.action('test_connection', {});
  assert.equal(ack.success, true);
  assert.deepEqual(Object.keys(ack.data.message), LANGUAGES);
  assert.match(ack.data.message.fr, /Connecté à PRONOTE en tant que DURAND Marie/);
  assert.match(ack.data.message.en, /DURAND Léa \(3E B, Collège Jean Moulin\): average 14,5/);
});

test('test_connection says why it failed, and restarts a paused loop once fixed', async () => {
  current = await createIntegration();
  current.api.failures.loginCredentials = 'BadCredentialsError';
  const failed = await current.gladys.fake.action('test_connection', {});
  // A failed ack, so Gladys shows it in red, still in every language.
  assert.equal(failed.success, false);
  assert.deepEqual(Object.keys(failed.error), LANGUAGES);
  assert.match(failed.error.fr, /refusé l’identifiant/);
  assert.equal(current.sync.timer, null);

  delete current.api.failures.loginCredentials;
  await current.gladys.fake.action('test_connection', {});
  assert.notEqual(current.sync.timer, null);
});

test('login_qr_code logs in, saves the session and reads', async () => {
  current = await createIntegration({ config: {} });
  const ack = await current.gladys.fake.action('login_qr_code', { qr_content: QR, pin: '1234' });
  assert.match(ack.data.message.fr, /Connecté avec le QR code/);
  assert.equal((await readJson(SESSION_FILE)).origin, 'qr');
  assert.equal(current.sync.snapshot.students.length, 2);
});

test('login_qr_code explains a wrong text and a refused code', async () => {
  current = await createIntegration({ config: {} });
  const wrong = await current.gladys.fake.action('login_qr_code', { qr_content: 'x', pin: '1' });
  assert.equal(wrong.success, false);
  assert.match(wrong.error.en, /not the content of a PRONOTE QR code/);

  current.api.failures.loginQrCode = 'BadCredentialsError';
  const refused = await current.gladys.fake.action('login_qr_code', {
    qr_content: QR,
    pin: '0000',
  });
  assert.equal(refused.success, false);
  assert.match(refused.error.fr, /4 chiffres/);
});

test('forget_session drops the token', async () => {
  current = await createIntegration();
  await current.sync.sync();
  assert.ok((await readJson(SESSION_FILE)).token);
  const ack = await current.gladys.fake.action('forget_session', {});
  assert.match(ack.data.message.en, /forgotten/);
  assert.equal((await readJson(SESSION_FILE)).token, undefined);
});
