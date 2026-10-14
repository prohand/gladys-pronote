// The snapshot of the fixture week, read through the fake pawnote.

import { readSnapshot } from '../../src/pronote/read.js';
import { createFakePawnote } from './fakePawnote.js';
import { NOW, lea, tom } from './fixtures.js';

export async function fixtureSnapshot(students = [lea(), tom()], now = NOW) {
  const api = createFakePawnote({ students, account: { name: 'DURAND Marie', unread: 2 } });
  const handle = api.createSessionHandle();
  await api.loginCredentials(handle, {
    url: 'https://0123456a.index-education.net/pronote',
    kind: 7,
    username: 'mdurand',
  });
  return readSnapshot(api, handle, now);
}
