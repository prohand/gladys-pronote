// -----------------------------------------------------------------------------
// What each PRONOTE failure means, in every language.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeError, ERROR_CODES, NotConfiguredError } from '../src/pronote/errors.js';
import { LANGUAGES } from '../src/i18n.js';
import { pawnoteError } from './helpers/fakePawnote.js';

test('pawnote errors are recognized by name', () => {
  assert.equal(describeError(pawnoteError('BadCredentialsError')).code, 'bad_credentials');
  assert.equal(describeError(pawnoteError('SecurityError')).code, 'security');
  assert.equal(describeError(pawnoteError('SuspendedIPError')).code, 'suspended_ip');
  assert.equal(describeError(new NotConfiguredError()).code, 'not_configured');
});

test('only the failures waiting can fix are retried', () => {
  assert.equal(describeError(pawnoteError('BadCredentialsError')).retry, false);
  assert.equal(describeError(pawnoteError('AccountDisabledError')).retry, false);
  assert.equal(describeError(pawnoteError('BusyPageError')).retry, true);
  assert.equal(describeError(pawnoteError('RateLimitedError')).retry, true);
  assert.equal(describeError(new Error('?')).retry, true);
});

test('a network failure reads as an unreachable server', () => {
  const fetchFailed = new TypeError('fetch failed', { cause: { code: 'ENOTFOUND' } });
  assert.equal(describeError(fetchFailed).code, 'unavailable');
  assert.equal(
    describeError(Object.assign(new Error('x'), { code: 'ECONNREFUSED' })).code,
    'unavailable',
  );
  assert.equal(describeError(new TypeError('x is not a function')).code, 'unknown');
});

test('every code has a message in every language', () => {
  for (const code of Object.values(ERROR_CODES)) {
    const name = {
      not_configured: 'NotConfiguredError',
      bad_credentials: 'BadCredentialsError',
      security: 'SecurityError',
      account_disabled: 'AccountDisabledError',
      suspended_ip: 'SuspendedIPError',
      rate_limited: 'RateLimitedError',
      unavailable: 'BusyPageError',
      session_expired: 'SessionExpiredError',
      session_closed: 'SessionClosedError',
      access_denied: 'AccessDeniedError',
      unknown: 'Error',
    }[code];
    const { message } = describeError(pawnoteError(name));
    assert.deepEqual(Object.keys(message), LANGUAGES, code);
    for (const language of LANGUAGES) {
      assert.ok(message[language].length > 10, `${code}.${language}`);
    }
  }
});
