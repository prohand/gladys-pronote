// -----------------------------------------------------------------------------
// The platform ids the devices are keyed on.
//
// External ids are forever: Gladys keys the device, its history, the scenes and
// the dashboards on them. PRONOTE's own ids are internal to one session, so the
// ids here are built from what stays: the server address and the student's
// name (the account's username for the account device). A student who changes
// class keeps their device; a new school year on the same server too.
// -----------------------------------------------------------------------------

import { contentKey } from '../pronote/format.js';
import { instanceBase } from '../pronote/session.js';

/** The platform id of a student. */
export function studentPlatformId(account, student) {
  return contentKey(instanceBase(account.url), student.name.trim().toLowerCase());
}

/** The platform id of the account. */
export function accountPlatformId(account) {
  return contentKey(instanceBase(account.url), 'account', account.name.trim().toLowerCase());
}
