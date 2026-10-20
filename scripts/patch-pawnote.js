// -----------------------------------------------------------------------------
// Teach the installed pawnote what PRONOTE 2026.2 expects: the new login
// challenge, and the selected child in every request of a parent account.
//
// 1. The login challenge.
//
// At login, PRONOTE sends a challenge that only the right password (or token)
// can answer. Up to 2026.1 the client decrypted it with the key derived from
// the password, kept one character out of two and encrypted the result back.
// Since 2026.2 the client encrypts the challenge as received, with the same key
// and IV (`getNouveauChallenge` in PRONOTE's own web client). pawnote 1.6.2
// still decrypts it, fails, and throws BadCredentialsError at every login:
// password, saved token and QR code alike.
//
// pawnote's `solveChallenge` is not exported, and no pawnote release knows the
// new challenge yet, so this script, run by `npm install` / `npm ci`
// (`postinstall`, the Docker image included), adds the 2026.2 branch to the
// installed pawnote. Servers older than 2026.2 keep the old answer.
// test/challenge.test.js logs in against a fake 2026.2 server: it fails if the
// installed pawnote cannot answer, patched or not.
//
// 2. The child of a parent account. PRONOTE's web client names the selected
// child in the signature of every request of the parent space
// (`Signature: { onglet, membre: { N, G } }`); pawnote 1.6.2 only sends the tab.
// A PRONOTE 2026.2 server answers "Accès refusé" to the grades of a parent
// account without it, then ends the session: every read logged in again and
// failed the same way, until PRONOTE suspended the IP address. The patch adds
// `membre` (the resource chosen with `use()`) to the signature of a parent
// account's requests, before pawnote encrypts them. test/member.test.js checks
// what the installed pawnote sends.
// -----------------------------------------------------------------------------

import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Left in the patched code, so a second run changes nothing. */
export const MARKER = '/*gladys-pronote:challenge-2026.2*/';

// pawnote's solveChallenge(session, identity, key), minified, e.g.
//   Se=(e,s,t)=>{const i=n.util.createBuffer(e.information.aesIV);try{const e=n.util.decodeUtf8(se.decrypt(s.challenge,t,i))
// Groups: 1 head, 2 session, 3 identity, 4 key, 5 iv, 6 forge, 7 the old try, 8 AES.
const SOLVE_CHALLENGE =
  /(\(\s*(\w+)\s*,\s*(\w+)\s*,\s*(\w+)\s*\)\s*=>\s*\{\s*const\s+(\w+)\s*=\s*([\w$.]+)\.util\.createBuffer\(\s*\2\.information\.aesIV\s*\)\s*;)(\s*try\s*\{\s*const\s+[\w$]+\s*=\s*\6\.util\.decodeUtf8\(\s*([\w$.]+)\.decrypt\(\s*\3\.challenge\s*,\s*\4\s*,\s*\5\s*\))/;

/**
 * Add the 2026.2 answer to pawnote's solveChallenge in one bundle.
 *
 * @param {string} source a pawnote dist file
 * @returns {{ source: string, status: 'patched' | 'already' | 'not-found' }}
 */
export function patchSource(source) {
  if (source.includes(MARKER)) {
    return { source, status: 'already' };
  }
  const match = SOLVE_CHALLENGE.exec(source);
  if (!match) {
    return { source, status: 'not-found' };
  }
  const [whole, head, session, identity, key, iv, forge, oldTry] = match;
  const aes = match[8];
  const since2026_2 = `((v)=>Array.isArray(v)&&(v[0]>2026||(v[0]===2026&&v[1]>=2)))(${session}.instance.version)`;
  const answer = `return ${aes}.encrypt(${forge}.util.encodeUtf8(${identity}.challenge),${key},${iv});`;
  const patched = `${head}${MARKER}if(${since2026_2})${answer}${oldTry}`;
  return {
    source: source.slice(0, match.index) + patched + source.slice(match.index + whole.length),
    status: 'patched',
  };
}

/** Left in the patched code by the second patch. */
export const MEMBER_MARKER = '/*gladys-pronote:parent-member*/';

// The start of RequestFN.process(), before the order number, the compression
// and the encryption: `this.data` is still the plain request.
const REQUEST_PROCESS = /process\(\)\{(?=this\.session\.information\.order\+\+;)/;

/** The signature of a parent account's request gets the selected child (AccountKind.PARENT = 7). */
const ADD_MEMBER =
  '((s,d)=>{const r=s.userResource,g=d&&(d.Signature||d._Signature_);' +
  'if(s.information.accountKind===7&&r&&r.id!==undefined&&g&&typeof g==="object"&&g.onglet!==undefined&&!g.membre)' +
  'g.membre={N:r.id,G:r.kind??4}})(this.session,this.data);';

/**
 * Send the selected child in the signature of a parent account's requests.
 *
 * @param {string} source a pawnote dist file
 * @returns {{ source: string, status: 'patched' | 'already' | 'not-found' }}
 */
export function patchMember(source) {
  if (source.includes(MEMBER_MARKER)) {
    return { source, status: 'already' };
  }
  const match = REQUEST_PROCESS.exec(source);
  if (!match) {
    return { source, status: 'not-found' };
  }
  const end = match.index + match[0].length;
  return {
    source: `${source.slice(0, end)}${MEMBER_MARKER}${ADD_MEMBER}${source.slice(end)}`,
    status: 'patched',
  };
}

const PATCHES = [
  ['login challenge', patchSource],
  ['parent child', patchMember],
];

/** Patch both bundles of the installed pawnote (ESM and CommonJS). */
export function patchInstalledPawnote() {
  let dist;
  try {
    dist = dirname(createRequire(import.meta.url).resolve('pawnote'));
  } catch {
    return [{ file: 'pawnote', status: 'not-installed' }];
  }
  return ['index.mjs', 'index.js'].flatMap((name) => {
    const file = join(dist, name);
    let source = readFileSync(file, 'utf8');
    const results = PATCHES.map(([patch, apply]) => {
      const result = apply(source);
      source = result.source;
      return { file, patch, status: result.status };
    });
    if (results.some((result) => result.status === 'patched')) {
      writeFileSync(file, source);
    }
    return results;
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const { file, patch = '', status } of patchInstalledPawnote()) {
    if (status === 'not-found' || status === 'not-installed') {
      // Not fatal: a newer pawnote may do it itself, and the test suite tells
      // whether it does.
      console.warn(`patch-pawnote: ${file}: ${patch || 'pawnote'} code not found, left as is`);
    } else {
      console.log(`patch-pawnote: ${file}: ${patch}: ${status}`);
    }
  }
}
