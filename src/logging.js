// -----------------------------------------------------------------------------
// Log level and clock, both switchable from the Configuration screen.
//
// The SDK logger re-reads `process.env.LOG_LEVEL` on every line, so writing that
// variable is enough to switch every logger at once, the SDK's own included. The
// level the container was started with is the baseline: the switch raises it to
// debug while it is on, and puts that value back — not `info` — when it goes off.
//
// The time zone matters more than for the logs: PRONOTE sends local times with
// no zone ("08:00" is 08:00 in the school's town), and they are turned into
// dates in the process time zone. Node re-reads `process.env.TZ` when it is
// assigned, so setting it before the first read is what makes "the next lesson"
// right in a container that runs in UTC.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';

const logger = createLogger({ name: 'logging' });

/** `LOG_LEVEL` as the container was started with, read once. */
const BASELINE = process.env.LOG_LEVEL;

/**
 * Apply the log level a configuration asks for.
 *
 * @param {{ debug_logs?: boolean }} config normalized configuration
 * @returns {string} the level in force afterwards
 */
export function applyLogLevel(config) {
  const wanted = config?.debug_logs ? 'debug' : BASELINE;
  const current = process.env.LOG_LEVEL;
  if (wanted === undefined) {
    delete process.env.LOG_LEVEL;
  } else {
    process.env.LOG_LEVEL = wanted;
  }
  if (current !== process.env.LOG_LEVEL) {
    logger.info(
      config?.debug_logs
        ? 'Detailed logs turned on'
        : `Detailed logs turned off (level: ${process.env.LOG_LEVEL ?? 'info'})`,
    );
  }
  return process.env.LOG_LEVEL ?? 'info';
}

/**
 * Whether the runtime knows an IANA time zone name.
 *
 * @param {string} zone
 */
export function isKnownTimeZone(zone) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Apply the time zone a configuration asks for. An unknown name is said once
 * and replaced by Europe/Paris, where most PRONOTE servers are.
 *
 * @param {{ timezone?: string }} config normalized configuration
 * @returns {string} the time zone in force afterwards
 */
export function applyTimeZone(config) {
  const wanted = String(config?.timezone ?? '').trim() || 'Europe/Paris';
  const zone = isKnownTimeZone(wanted) ? wanted : 'Europe/Paris';
  if (zone !== wanted) {
    logger.warn(`Unknown time zone "${wanted}": Europe/Paris is used instead`);
  }
  if (process.env.TZ !== zone) {
    process.env.TZ = zone;
    logger.info(`PRONOTE times are read in ${zone}`);
  }
  return zone;
}
