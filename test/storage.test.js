// -----------------------------------------------------------------------------
// JSON files in the data directory.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readJson, removeJson, writeJson } from '../src/storage.js';
import { useTemporaryDataDir } from './helpers/dataDir.js';

const data = await useTemporaryDataDir();

test('a file written is read back, a missing one is the fallback', async () => {
  assert.equal(await writeJson('a.json', { x: 1 }), true);
  assert.deepEqual(await readJson('a.json'), { x: 1 });
  await removeJson('a.json');
  assert.deepEqual(await readJson('a.json', { y: 2 }), { y: 2 });
  await removeJson('a.json');
});

test('a broken file is the fallback, not a crash', async () => {
  await writeFile(join(data.dir, 'broken.json'), '{');
  assert.equal(await readJson('broken.json', null), null);
});

test('a directory that cannot be written costs the memory, not the work', async () => {
  // A data "directory" that is a file: every write fails.
  await writeFile(join(data.dir, 'file'), '');
  process.env.PRONOTE_DATA_DIR = join(data.dir, 'file', 'sub');
  assert.equal(await writeJson('a.json', {}), false);
  process.env.PRONOTE_DATA_DIR = data.dir;
});
