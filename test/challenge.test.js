// -----------------------------------------------------------------------------
// The login challenge of PRONOTE 2026.2, answered by the installed pawnote.
//
// A fake PRONOTE server (node:crypto, written from PRONOTE's own web client, not
// from pawnote) checks the answer to the challenge the way the real one does. It
// fails when `npm install` did not run scripts/patch-pawnote.js, or when a newer
// pawnote answers differently.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import * as pawnote from 'pawnote';
import { createPronoteFetcher } from '../src/pronote/fetcher.js';
import { MARKER, patchSource } from '../scripts/patch-pawnote.js';

const BASE = 'https://0123456a.index-education.net/pronote';
const USERNAME = 'Demonstration';
const PASSWORD = 'pronotevs';

const md5 = (bytes) => createHash('md5').update(bytes).digest();
const sha256Hex = (text) => createHash('sha256').update(text, 'utf8').digest('hex').toUpperCase();

// PRONOTE's AES: key and IV are the MD5 of the given bytes, an empty IV is zeros.
function aesEncrypt(text, key, iv) {
  const cipher = createCipheriv('aes-128-cbc', md5(key), iv.length ? md5(iv) : Buffer.alloc(16));
  return Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]).toString('hex');
}

function aesDecrypt(hex, key, iv) {
  const decipher = createDecipheriv(
    'aes-128-cbc',
    md5(key),
    iv.length ? md5(iv) : Buffer.alloc(16),
  );
  return Buffer.concat([decipher.update(Buffer.from(hex, 'hex')), decipher.final()]).toString();
}

/**
 * A PRONOTE server that knows one account, unencrypted and uncompressed
 * requests (no `CrA` / `CoA`), as the demo server answers.
 *
 * @param {string} version e.g. '2026.2.7'
 * @param {object} [account] `secret` is the password, or the token of a QR code
 */
function createFakeServer(version, { username = USERNAME, secret = PASSWORD } = {}) {
  const [major, minor] = version.split('.').map(Number);
  const newChallenge = major > 2026 || (major === 2026 && minor >= 2);
  const state = { answers: [] };
  const reply = (id, data) => JSON.stringify({ id, session: 4010264, no: 'X', dataSec: { data } });

  const instancePage = newChallenge
    ? `<div>PRONOTE ${version}</div><script>try{Start ({"h":4010264,"a":6});} catch (e) {}</script>`
    : `<div>PRONOTE ${version}</div><script>try{Start ({"h":4010264,"a":6})}catch (e) {}</script>`;

  function answer(id, data) {
    switch (id) {
      case 'FonctionParametres':
        state.iv = Buffer.from(data.Uuid, 'base64');
        return reply(id, {
          identifiantNav: 'NAV',
          General: {
            versionPN: version,
            DomainesFrequences: [null, { V: '[]' }, { V: '[]' }],
            LibellesFrequences: ['', 'Q1', 'Q2'],
            JourOuvre: { V: '19/10/2026' },
            PremierLundi: { V: '31/08/2026' },
            PremiereDate: { V: '01/09/2026' },
            DerniereDate: { V: '04/07/2027' },
            ListeHeuresFin: { V: [] },
            ListePeriodes: [],
            listeJoursFeries: { V: [] },
            PlacesParJour: 20,
          },
        });
      case 'Identification': {
        const alea = randomBytes(8).toString('hex');
        // modeCompLog: 1 → the key uses the username in lower case.
        state.key = Buffer.from(
          String(data.identifiant).toLowerCase() + sha256Hex(alea + secret),
          'latin1',
        );
        state.identifiant = data.identifiant;
        const nonce = randomBytes(16).toString('hex').toUpperCase();
        let challenge;
        if (newChallenge) {
          // 2026.2: the client encrypts the challenge as it is.
          challenge = nonce;
          state.expected = aesEncrypt(nonce, state.key, state.iv);
        } else {
          // Before: one character out of two is noise to drop after decrypting.
          const scrambled = [...nonce].map((char) => `${char}~`).join('');
          challenge = aesEncrypt(scrambled, state.key, state.iv);
          state.expected = aesEncrypt(nonce, state.key, state.iv);
        }
        return reply(id, { alea, modeCompMdp: 0, modeCompLog: 1, challenge });
      }
      case 'Authentification': {
        const accepted =
          String(data.challenge).toLowerCase() === state.expected &&
          state.identifiant.toLowerCase() === username.toLowerCase();
        state.answers.push(accepted ? 'accepted' : 'refused');
        if (!accepted) {
          return reply(id, { Acces: 1 });
        }
        const cle = aesEncrypt([...randomBytes(16)].join(','), state.key, state.iv);
        return reply(id, { cle, jetonConnexionAppliMobile: 'NEW-TOKEN', login: username });
      }
      default:
        // The login is over: stop here, the reads are not what this file tests.
        state.after = id;
        return JSON.stringify({ Erreur: { Titre: 'end of the fake server' } });
    }
  }

  const fakeFetch = async (href, options = {}) => {
    const path = new URL(href).pathname;
    let text;
    if (/\/mobile\.eleve\.html$/.test(path)) {
      text = instancePage;
    } else {
      const body = JSON.parse(options.body);
      text = answer(body.id, body.dataSec.data);
    }
    return { status: 200, text: async () => text, headers: new Headers() };
  };

  return { state, fetcher: createPronoteFetcher(fakeFetch) };
}

async function loginWithPassword(server, password = PASSWORD) {
  const handle = pawnote.createSessionHandle(server.fetcher);
  return pawnote.loginCredentials(handle, {
    url: BASE,
    kind: pawnote.AccountKind.STUDENT,
    username: USERNAME,
    password,
    deviceUUID: 'device',
  });
}

test('pawnote answers the PRONOTE 2026.2 challenge of a password login', async () => {
  const server = createFakeServer('2026.2.7');
  await assert.rejects(loginWithPassword(server), { name: 'ServerSideError' });
  assert.deepEqual(server.state.answers, ['accepted']);
  // Logged in: pawnote went on to read the user parameters.
  assert.equal(server.state.after, 'ParametresUtilisateur');
});

test('a wrong password is still refused by a PRONOTE 2026.2 server', async () => {
  const server = createFakeServer('2026.2.7');
  await assert.rejects(loginWithPassword(server, 'wrong'), { name: 'BadCredentialsError' });
  assert.deepEqual(server.state.answers, ['refused']);
});

test('pawnote answers the PRONOTE 2026.2 challenge of a QR code login', async () => {
  const pin = Buffer.from('1234');
  const token = 'QR-TOKEN-0123456789';
  const server = createFakeServer('2026.2.7', { secret: token });
  const handle = pawnote.createSessionHandle(server.fetcher);
  const login = pawnote.loginQrCode(handle, {
    deviceUUID: 'device',
    pin: '1234',
    qr: {
      avecPageConnexion: false,
      jeton: aesEncrypt(token, pin, Buffer.alloc(0)),
      login: aesEncrypt(USERNAME, pin, Buffer.alloc(0)),
      url: `${BASE}/mobile.eleve.html`,
    },
  });
  await assert.rejects(login, { name: 'ServerSideError' });
  assert.deepEqual(server.state.answers, ['accepted']);
});

test('servers older than 2026.2 still get the old answer', async () => {
  for (const version of ['2025.2.9', '2026.1.4']) {
    const server = createFakeServer(version);
    await assert.rejects(loginWithPassword(server), { name: 'ServerSideError' }, version);
    assert.deepEqual(server.state.answers, ['accepted'], version);
  }
});

test('the fake server decrypts what it encrypts (sanity check of the test itself)', () => {
  const key = Buffer.from('key');
  const iv = randomBytes(16);
  assert.equal(aesDecrypt(aesEncrypt('challenge', key, iv), key, iv), 'challenge');
});

// solveChallenge as minified in pawnote 1.6.2, ESM then CommonJS bundle.
const MINIFIED_ESM =
  'Se=(e,s,t)=>{const i=n.util.createBuffer(e.information.aesIV);try{const e=n.util.decodeUtf8(se.decrypt(s.challenge,t,i)),a=new Array(e.length);return a}catch{throw new c}},';
const MINIFIED_CJS =
  'we=(e,s,t)=>{const n=i.default.util.createBuffer(e.information.aesIV);try{const e=i.default.util.decodeUtf8(J.decrypt(s.challenge,t,n)),a=new Array(e.length);return a}catch{throw new o}},';

test('patchSource adds the 2026.2 answer before the old one, in both bundles', () => {
  const esm = patchSource(MINIFIED_ESM);
  assert.equal(esm.status, 'patched');
  assert.ok(
    esm.source.includes(
      `const i=n.util.createBuffer(e.information.aesIV);${MARKER}if(((v)=>Array.isArray(v)&&(v[0]>2026||(v[0]===2026&&v[1]>=2)))(e.instance.version))return se.encrypt(n.util.encodeUtf8(s.challenge),t,i);try{`,
    ),
  );

  const cjs = patchSource(MINIFIED_CJS);
  assert.equal(cjs.status, 'patched');
  assert.ok(
    cjs.source.includes('return J.encrypt(i.default.util.encodeUtf8(s.challenge),t,n);try{'),
  );
});

test('patchSource changes nothing the second time, nor in unknown code', () => {
  const once = patchSource(MINIFIED_ESM).source;
  assert.deepEqual(patchSource(once), { source: once, status: 'already' });

  const other = 'const x=1;';
  assert.deepEqual(patchSource(other), { source: other, status: 'not-found' });
});
