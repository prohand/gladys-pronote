// -----------------------------------------------------------------------------
// Configuration defaults and normalization.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, hasCredentials, normalizeConfig } from '../src/config.js';

test('an empty configuration is the defaults', () => {
  assert.deepEqual(normalizeConfig(), DEFAULT_CONFIG);
  assert.deepEqual(normalizeConfig(null), DEFAULT_CONFIG);
});

test('numbers typed as strings are numbers, kept inside their bounds', () => {
  const config = normalizeConfig({ refresh_interval: '30', homework_days: '99' });
  assert.equal(config.refresh_interval, 30);
  assert.equal(config.homework_days, 21);
  assert.equal(normalizeConfig({ refresh_interval: 1 }).refresh_interval, 5);
  assert.equal(normalizeConfig({ refresh_interval: 'abc' }).refresh_interval, 30);
});

test('an empty field from the form falls back to its default', () => {
  const config = normalizeConfig({ url: null, timezone: '  ', account_kind: 'teacher' });
  assert.equal(config.url, '');
  assert.equal(config.timezone, 'Europe/Paris');
  assert.equal(config.account_kind, 'student');
});

test('a password login needs the address, the username and the password', () => {
  assert.equal(hasCredentials(normalizeConfig({ url: 'x', username: 'u', password: 'p' })), true);
  assert.equal(hasCredentials(normalizeConfig({ url: 'x', username: 'u' })), false);
  assert.equal(hasCredentials(normalizeConfig({ url: ' ', username: 'u', password: 'p' })), false);
});

test('debug_logs is a real boolean', () => {
  assert.equal(normalizeConfig({ debug_logs: 'true' }).debug_logs, true);
  assert.equal(normalizeConfig({ debug_logs: 'yes' }).debug_logs, false);
});
