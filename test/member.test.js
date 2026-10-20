// -----------------------------------------------------------------------------
// The child of a parent account, named in the signature of every request.
//
// The installed pawnote builds real requests against a fetcher that records
// them (no encryption, no compression, as the demo server allows). It fails when
// `npm install` did not run scripts/patch-pawnote.js, or when a newer pawnote
// stops sending the child.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as pawnote from 'pawnote';
import { MEMBER_MARKER, patchMember } from '../scripts/patch-pawnote.js';

const PERIOD = {
  id: 'T1',
  kind: 1,
  name: 'Trimestre 1',
  startDate: new Date(2026, 8, 1),
  endDate: new Date(2026, 10, 30),
};
const CHILD = { id: '42#abc', kind: 4, name: 'DURAND Léa' };

/** A logged-in handle, as pawnote leaves it after a login. */
function loggedIn(kind, version = [2026, 2, 7]) {
  const sent = [];
  const handle = pawnote.createSessionHandle(async (request) => {
    sent.push(JSON.parse(request.content));
    return { status: 200, content: JSON.stringify({ Erreur: { Titre: 'stop' } }), headers: {} };
  });
  handle.information = {
    url: 'https://0123456a.index-education.net/pronote',
    accountKind: kind,
    id: 4010264,
    order: 2,
    skipCompression: true,
    skipEncryption: true,
    aesKey: '',
    aesIV: '',
  };
  handle.instance = { version };
  return { handle, sent };
}

test('a parent account names the selected child in the signature', async () => {
  const { handle, sent } = loggedIn(pawnote.AccountKind.PARENT);
  pawnote.use(handle, CHILD);
  await assert.rejects(pawnote.gradesOverview(handle, PERIOD), { name: 'ServerSideError' });

  assert.equal(sent[0].id, 'DernieresNotes');
  assert.deepEqual(sent[0].dataSec.Signature, {
    onglet: pawnote.TabLocation.Grades,
    membre: { N: '42#abc', G: 4 },
  });
});

test('the child follows use(), request after request', async () => {
  const { handle, sent } = loggedIn(pawnote.AccountKind.PARENT);
  pawnote.use(handle, CHILD);
  await assert.rejects(pawnote.gradesOverview(handle, PERIOD), { name: 'ServerSideError' });
  pawnote.use(handle, { id: '43#def', kind: 4, name: 'DURAND Tom' });
  await assert.rejects(pawnote.notebook(handle, PERIOD), { name: 'ServerSideError' });

  assert.deepEqual(
    sent.map((body) => body.dataSec.Signature.membre.N),
    ['42#abc', '43#def'],
  );
});

test('older servers get the child under their own signature name', async () => {
  const { handle, sent } = loggedIn(pawnote.AccountKind.PARENT, [2024, 1, 0]);
  pawnote.use(handle, CHILD);
  await assert.rejects(pawnote.gradesOverview(handle, PERIOD), { name: 'ServerSideError' });

  assert.deepEqual(sent[0].donneesSec._Signature_.membre, { N: '42#abc', G: 4 });
});

test('a student account sends the tab only', async () => {
  const { handle, sent } = loggedIn(pawnote.AccountKind.STUDENT);
  pawnote.use(handle, CHILD);
  await assert.rejects(pawnote.gradesOverview(handle, PERIOD), { name: 'ServerSideError' });

  assert.deepEqual(sent[0].dataSec.Signature, { onglet: pawnote.TabLocation.Grades });
});

// RequestFN.process() as minified in pawnote 1.6.2.
const MINIFIED =
  'ae=class{constructor(e,s,t){this.session=e,this.name=s,this.data=t}process(){this.session.information.order++;const e=this.generateOrder()';

test('patchMember adds the child before the order number, once', () => {
  const once = patchMember(MINIFIED);
  assert.equal(once.status, 'patched');
  assert.ok(once.source.includes(`process(){${MEMBER_MARKER}((s,d)=>{`));
  assert.ok(once.source.includes('})(this.session,this.data);this.session.information.order++;'));

  assert.deepEqual(patchMember(once.source), { source: once.source, status: 'already' });
  assert.deepEqual(patchMember('const x=1;'), { source: 'const x=1;', status: 'not-found' });
});
