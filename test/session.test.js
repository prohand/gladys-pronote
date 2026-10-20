// -----------------------------------------------------------------------------
// Logging in: the saved token first, the password when there is none, the QR
// code for ENT accounts — and the token saved again after every login.
// -----------------------------------------------------------------------------

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig } from '../src/config.js';
import {
  PronoteSession,
  SESSION_FILE,
  instanceBase,
  parseQrContent,
} from '../src/pronote/session.js';
import { readJson, writeJson } from '../src/storage.js';
import {
  PASSWORD_CONFIG,
  createFakePawnote,
  pawnoteError,
  studentResource,
} from './helpers/fakePawnote.js';
import { useTemporaryDataDir } from './helpers/dataDir.js';

const data = await useTemporaryDataDir();

function setup(config = PASSWORD_CONFIG) {
  const api = createFakePawnote({ students: [studentResource('S1', 'DURAND Léa')] });
  const session = new PronoteSession({ api });
  session.setConfig(normalizeConfig(config));
  return { api, session };
}

beforeEach(async () => {
  await data.reset();
});

test('instanceBase keeps the server and the path, not the page', () => {
  assert.equal(
    instanceBase('https://0123456A.index-education.net/pronote/eleve.html?login=true'),
    'https://0123456a.index-education.net/pronote',
  );
  assert.equal(
    instanceBase('0123456a.index-education.net/pronote/'),
    'https://0123456a.index-education.net/pronote',
  );
  assert.equal(instanceBase(''), '');
  assert.equal(instanceBase('http://['), '');
});

test('the first login uses the password and saves the token with its device id', async () => {
  const { api, session } = setup();
  await session.open();

  assert.deepEqual(
    api.calls.map(([name]) => name),
    ['loginCredentials'],
  );
  const [, auth] = api.calls[0];
  assert.equal(auth.url, 'https://0123456a.index-education.net/pronote');
  assert.equal(auth.kind, 6);
  const saved = await readJson(SESSION_FILE);
  assert.equal(saved.token, 'token-1');
  assert.equal(saved.deviceUUID, auth.deviceUUID);
  assert.equal(saved.origin, 'password');
  assert.equal(session.method, 'password');
});

test('the next login uses the saved token, on the same device id, and saves the new one', async () => {
  const { api, session: first } = setup();
  await first.open();
  const { deviceUUID } = await readJson(SESSION_FILE);

  // A restart: a new session object, the same PRONOTE.
  const session = new PronoteSession({ api });
  session.setConfig(normalizeConfig(PASSWORD_CONFIG));
  await session.open();

  assert.deepEqual(
    api.calls.map(([name]) => name),
    ['loginCredentials', 'loginToken'],
  );
  assert.equal(api.calls[1][1].token, 'token-1');
  assert.equal(api.calls[1][1].deviceUUID, deviceUUID);
  // PRONOTE hands a new token at every login: the new one is kept.
  assert.equal((await readJson(SESSION_FILE)).token, 'token-2');
  assert.equal(session.method, 'token');
});

test('a refused token falls back to the password', async () => {
  await setup().session.open();
  const { api, session } = setup();
  api.failures.loginToken = 'BadCredentialsError';

  await session.open();

  assert.deepEqual(
    api.calls.map(([name]) => name),
    ['loginToken', 'loginCredentials'],
  );
  assert.equal(session.method, 'password');
});

test('a token saved for another username is not used', async () => {
  await setup().session.open();
  const { api } = setup({ ...PASSWORD_CONFIG, username: 'someone-else' });
  const session = new PronoteSession({ api });
  session.setConfig(normalizeConfig({ ...PASSWORD_CONFIG, username: 'someone-else' }));

  await session.open();

  assert.deepEqual(
    api.calls.map(([name]) => name),
    ['loginCredentials'],
  );
});

test('nothing to log in with is said as such', async () => {
  const { session } = setup({});
  await assert.rejects(session.open(), { name: 'NotConfiguredError' });
});

test('a network error on the token is not taken for a refused token', async () => {
  await setup().session.open();
  const { api, session } = setup();
  api.failures.loginToken = 'BusyPageError';

  await assert.rejects(session.open(), { name: 'BusyPageError' });
  assert.equal((await readJson(SESSION_FILE)).token, 'token-1');
});

test('an expired session is opened again and the read retried once', async () => {
  const { api, session } = setup();
  await session.open(); // an earlier read
  let attempts = 0;
  const result = await session.run(async () => {
    attempts += 1;
    if (attempts === 1) {
      throw pawnoteError('SessionExpiredError');
    }
    return 'read';
  });

  assert.equal(result, 'read');
  assert.equal(attempts, 2);
  assert.deepEqual(
    api.calls.map(([name]) => name),
    ['loginCredentials', 'loginToken'],
  );
});

test('a session closed by the read that opened it is not opened again', async () => {
  const { api, session } = setup();
  let attempts = 0;
  const read = session.run(async () => {
    attempts += 1;
    throw pawnoteError('SessionExpiredError');
  });

  await assert.rejects(read, { name: 'SessionClosedError' });
  assert.equal(attempts, 1);
  assert.deepEqual(
    api.calls.map(([name]) => name),
    ['loginCredentials'],
  );
  assert.equal(session.handle, null);
});

test('a session closed again right after the new login stops there', async () => {
  const { api, session } = setup();
  await session.open();
  let attempts = 0;
  const read = session.run(async () => {
    attempts += 1;
    throw pawnoteError('SessionExpiredError');
  });

  await assert.rejects(read, { name: 'SessionClosedError' });
  assert.equal(attempts, 2);
  assert.deepEqual(
    api.calls.map(([name]) => name),
    ['loginCredentials', 'loginToken'],
  );
});

test('two reads at once share one login', async () => {
  const { api, session } = setup();
  await Promise.all([session.open(), session.open()]);
  assert.equal(api.calls.length, 1);
});

test('a changed address drops the open session', async () => {
  const { session } = setup();
  await session.open();
  session.setConfig(normalizeConfig({ ...PASSWORD_CONFIG, url: 'https://other.example/pronote' }));
  assert.equal(session.handle, null);
});

test('the QR code login saves a session the next start uses without a password', async () => {
  const { api, session } = setup({});
  const qr = JSON.stringify({
    jeton: 'ABC',
    login: 'DEF',
    url: 'https://0123456a.index-education.net/pronote/mobile.eleve.html',
  });
  await session.loginWithQrCode({ qr, pin: ' 1234 ' });

  assert.equal(api.calls[0][1].pin, '1234');
  assert.equal(api.calls[0][1].qr.jeton, 'ABC');
  assert.equal((await readJson(SESSION_FILE)).origin, 'qr');

  const next = setup({});
  await next.session.open();
  assert.deepEqual(
    next.api.calls.map(([name]) => name),
    ['loginToken'],
  );
});

test('parseQrContent refuses anything but a PRONOTE QR code', () => {
  assert.throws(() => parseQrContent('hello'), { name: 'InvalidQrCodeError' });
  assert.throws(() => parseQrContent('{"jeton":"a"}'), { name: 'InvalidQrCodeError' });
  assert.deepEqual(parseQrContent(' {"jeton":"a","login":"b","url":"https://x/y"} '), {
    jeton: 'a',
    login: 'b',
    url: 'https://x/y',
  });
});

test('forget keeps the device id but not the token', async () => {
  const { session } = setup();
  await session.open();
  const { deviceUUID } = await readJson(SESSION_FILE);

  await session.forget();

  assert.deepEqual(await readJson(SESSION_FILE), { deviceUUID });
  assert.equal(await session.savedAccount(), null);
});

test('the session file is only readable by its owner', async () => {
  await writeJson(SESSION_FILE, { token: 't' });
  const { stat } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const mode = (await stat(join(data.dir, SESSION_FILE))).mode & 0o777;
  assert.equal(mode, 0o600);
});
