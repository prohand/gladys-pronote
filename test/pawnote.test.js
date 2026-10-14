// -----------------------------------------------------------------------------
// The pawnote functions the integration calls exist, with the names and error
// classes the code expects. The fake of test/helpers/fakePawnote.js mirrors
// them: this file is what tells a Dependabot bump that renamed one.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as pawnote from 'pawnote';
import { createFakePawnote } from './helpers/fakePawnote.js';

const USED = [
  'createSessionHandle',
  'loginCredentials',
  'loginToken',
  'loginQrCode',
  'use',
  'gradesOverview',
  'assignmentsFromIntervals',
  'timetableFromIntervals',
  'parseTimetable',
  'notebook',
  'discussions',
];

test('every pawnote function the integration uses exists, and the fake has it too', () => {
  const fake = createFakePawnote({ students: [] });
  for (const name of USED) {
    assert.equal(typeof pawnote[name], 'function', `pawnote.${name}`);
    assert.equal(typeof fake[name], 'function', `fake.${name}`);
  }
});

test('the error classes recognized by name are pawnote’s', () => {
  for (const name of [
    'BadCredentialsError',
    'AuthenticateError',
    'SecurityError',
    'AccountDisabledError',
    'SuspendedIPError',
    'RateLimitedError',
    'BusyPageError',
    'PageUnavailableError',
    'SessionExpiredError',
    'AccessDeniedError',
  ]) {
    assert.equal(typeof pawnote[name], 'function', name);
  }
  assert.equal(new pawnote.SessionExpiredError().name, 'SessionExpiredError');
  assert.equal(new pawnote.BadCredentialsError().name, 'BadCredentialsError');
});

test('the account kinds and tab numbers the code hard-codes are pawnote’s', () => {
  assert.equal(pawnote.AccountKind.STUDENT, 6);
  assert.equal(pawnote.AccountKind.PARENT, 7);
  assert.equal(pawnote.TabLocation.Grades, 198);
  assert.equal(pawnote.TabLocation.Notebook, 19);
  assert.equal(pawnote.GradeKind.Grade, 0);
  assert.equal(pawnote.GradeKind.AbsentZero, 6);
  assert.equal(pawnote.GradeKind.UnreturnedZero, 7);
});

test('a fresh session handle is not logged in', () => {
  const handle = pawnote.createSessionHandle();
  assert.ok(!handle.user);
});
