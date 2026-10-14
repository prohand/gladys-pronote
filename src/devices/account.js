// -----------------------------------------------------------------------------
// Device type: ACCOUNT
//
// What belongs to the PRONOTE account rather than to one student: the unread
// messages. On a parent account they are the parent's, shared by the children,
// so they would be wrong on any one child's device.
// -----------------------------------------------------------------------------

import { DEVICE_FEATURE_CATEGORIES, DEVICE_FEATURE_TYPES } from '@gladysassistant/integration-sdk';
import { accountPlatformId } from './ids.js';

export const DEVICE_TYPE = 'account';

/** Feature keys: stored by Gladys, never rename them. */
export const FEATURES = { UNREAD_MESSAGES: 'unread-messages' };

export function accountIds(gladys, account) {
  return gladys.externalIds(DEVICE_TYPE, accountPlatformId(account));
}

export function buildAccountDevice(gladys, account) {
  const ids = accountIds(gladys, account);
  return {
    // "Messages": on a student account, the account and the student have the
    // same name, and two devices called the same would be told apart by nobody.
    name: `PRONOTE messages – ${account.name || 'account'}`,
    external_id: ids.device,
    should_poll: false,
    features: [
      {
        name: 'Unread messages',
        external_id: ids.feature(FEATURES.UNREAD_MESSAGES),
        category: DEVICE_FEATURE_CATEGORIES.UNKNOWN,
        type: DEVICE_FEATURE_TYPES.UNKNOWN.UNKNOWN,
        read_only: true,
        has_feedback: false,
        keep_history: true,
        min: 0,
        max: 10000,
      },
    ],
  };
}

export function accountStates(gladys, account) {
  if (typeof account.unread_messages !== 'number') {
    return [];
  }
  return [
    {
      device_feature_external_id: accountIds(gladys, account).feature(FEATURES.UNREAD_MESSAGES),
      state: account.unread_messages,
    },
  ];
}
