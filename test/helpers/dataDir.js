// A fresh data directory per test file: the session token and the memory of
// what was announced are written there instead of /data.

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export async function useTemporaryDataDir() {
  // The integration's own log lines would drown the test report.
  process.env.LOG_LEVEL ??= 'silent';
  const dir = await mkdtemp(join(tmpdir(), 'gladys-pronote-'));
  process.env.PRONOTE_DATA_DIR = dir;
  return {
    dir,
    async reset() {
      await rm(dir, { recursive: true, force: true });
    },
  };
}
