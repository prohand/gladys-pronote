// -----------------------------------------------------------------------------
// The log level and the time zone set from the configuration.
// -----------------------------------------------------------------------------

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { applyLogLevel, applyTimeZone, isKnownTimeZone } from '../src/logging.js';

const initialTz = process.env.TZ;
const initialLevel = process.env.LOG_LEVEL;
after(() => {
  process.env.TZ = initialTz ?? '';
  if (initialLevel === undefined) {
    delete process.env.LOG_LEVEL;
  } else {
    process.env.LOG_LEVEL = initialLevel;
  }
});

test('debug logs raise the level, and put the baseline back', () => {
  assert.equal(applyLogLevel({ debug_logs: true }), 'debug');
  assert.equal(process.env.LOG_LEVEL, 'debug');
  assert.equal(applyLogLevel({ debug_logs: false }), initialLevel ?? 'info');
});

test('the time zone of the school becomes the one of the process', () => {
  assert.equal(applyTimeZone({ timezone: 'Indian/Reunion' }), 'Indian/Reunion');
  assert.equal(new Date('2026-10-14T06:00:00Z').getHours(), 10);
  assert.equal(applyTimeZone({ timezone: 'Mars/Olympus' }), 'Europe/Paris');
  assert.equal(new Date('2026-10-14T06:00:00Z').getHours(), 8);
});

test('isKnownTimeZone', () => {
  assert.equal(isKnownTimeZone('America/Martinique'), true);
  assert.equal(isKnownTimeZone('Nowhere/Town'), false);
});
