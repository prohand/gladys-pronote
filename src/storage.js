// -----------------------------------------------------------------------------
// Small JSON files in /data, the only writable path of the container.
//
// Two things must survive a restart:
//   - the PRONOTE session token (and the device id it is bound to), so the
//     integration does not log in with the password every time — PRONOTE treats
//     each password login as a new device and may ask for a second factor;
//   - what was already seen (grades, homework…), so a restart does not fire
//     the scene triggers again for everything.
//
// The directory can be moved with PRONOTE_DATA_DIR (the tests do). Files are
// written to a temporary name then renamed, so a crash never leaves half a file,
// and with mode 0600: the session token is as good as a password.
// -----------------------------------------------------------------------------

import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createLogger } from '@gladysassistant/integration-sdk';

const logger = createLogger({ name: 'storage' });

/** The directory the files live in. */
export function dataDir() {
  return process.env.PRONOTE_DATA_DIR || '/data';
}

/**
 * Read a JSON file, `fallback` when it is missing or unreadable.
 *
 * @param {string} name file name inside the data directory
 * @param {unknown} fallback
 */
export async function readJson(name, fallback = null) {
  try {
    return JSON.parse(await readFile(join(dataDir(), name), 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') {
      logger.warn(`Cannot read ${name}: ${err.message}`);
    }
    return fallback;
  }
}

/**
 * Write a JSON file atomically. Never throws: a read-only /data costs the
 * integration its memory across restarts, not its work.
 *
 * @param {string} name
 * @param {unknown} value
 * @returns {Promise<boolean>} whether it was written
 */
export async function writeJson(name, value) {
  const path = join(dataDir(), name);
  const temporary = `${path}.tmp`;
  try {
    await mkdir(dataDir(), { recursive: true });
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, path);
    return true;
  } catch (err) {
    logger.warn(`Cannot write ${name}: ${err.message}`);
    return false;
  }
}

/**
 * Delete a file, silently when it does not exist.
 *
 * @param {string} name
 */
export async function removeJson(name) {
  await rm(join(dataDir(), name), { force: true });
}
