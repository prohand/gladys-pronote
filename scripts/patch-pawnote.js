// -----------------------------------------------------------------------------
// Teach the installed pawnote the login challenge of PRONOTE 2026.2.
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

/** Patch both bundles of the installed pawnote (ESM and CommonJS). */
export function patchInstalledPawnote() {
  let dist;
  try {
    dist = dirname(createRequire(import.meta.url).resolve('pawnote'));
  } catch {
    return [{ file: 'pawnote', status: 'not-installed' }];
  }
  return ['index.mjs', 'index.js'].map((name) => {
    const file = join(dist, name);
    const result = patchSource(readFileSync(file, 'utf8'));
    if (result.status === 'patched') {
      writeFileSync(file, result.source);
    }
    return { file, status: result.status };
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const { file, status } of patchInstalledPawnote()) {
    if (status === 'not-found' || status === 'not-installed') {
      // Not fatal: a newer pawnote may know the new challenge itself, and the
      // test suite tells whether it does.
      console.warn(`patch-pawnote: ${file}: login challenge code not found, left as is`);
    } else {
      console.log(`patch-pawnote: ${file}: ${status}`);
    }
  }
}
