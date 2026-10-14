// -----------------------------------------------------------------------------
// Integration configuration.
//
// The configuration is filled in by the user in Gladys, from the `config_schema`
// declared in `gladys-assistant-integration.json`. The SDK fetches it for you
// (`gladys.getConfig()`) and notifies every change through
// `gladys.onConfigUpdated()`.
//
// This module only provides defaults and normalizes the received object, so the
// rest of the code never has to deal with `undefined` or with a number typed
// as a string.
// -----------------------------------------------------------------------------

/** The PRONOTE spaces this integration logs into (the `account_kind` field). */
export const ACCOUNT_KINDS = { STUDENT: 'student', PARENT: 'parent' };

// Defaults: they MUST stay consistent with the `default` values declared in the
// `config_schema` of the manifest (test/manifest.test.js checks it).
export const DEFAULT_CONFIG = {
  url: '',
  account_kind: ACCOUNT_KINDS.STUDENT,
  username: '',
  password: '',
  // Minutes between two reads of PRONOTE. A school server is shared by the
  // whole school: reading it more often than every few minutes brings nothing
  // (grades and homework are typed by hand) and gets an IP rate-limited.
  refresh_interval: 15,
  // How many days ahead the homework is read.
  homework_days: 7,
  // PRONOTE writes local times without a zone: they are read in this one.
  timezone: 'Europe/Paris',
  debug_logs: false,
};

/** Bounds of the number fields, the same as the manifest `min` / `max`. */
const BOUNDS = {
  refresh_interval: [5, 120],
  homework_days: [1, 21],
};

/**
 * Merge the user config with the defaults and force the types: a form may
 * send numbers as strings, and an empty field as `null`.
 *
 * @param {Record<string, unknown>} raw config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const config = { ...DEFAULT_CONFIG };
  for (const [key, value] of Object.entries(raw ?? {})) {
    if (value !== undefined && value !== null) {
      config[key] = value;
    }
  }
  config.url = String(config.url).trim();
  config.username = String(config.username).trim();
  config.password = String(config.password);
  config.account_kind = Object.values(ACCOUNT_KINDS).includes(config.account_kind)
    ? config.account_kind
    : DEFAULT_CONFIG.account_kind;
  for (const [key, [min, max]] of Object.entries(BOUNDS)) {
    const value = Math.round(Number(config[key]));
    config[key] = Number.isFinite(value)
      ? Math.min(max, Math.max(min, value))
      : DEFAULT_CONFIG[key];
  }
  config.timezone = String(config.timezone).trim() || DEFAULT_CONFIG.timezone;
  config.debug_logs = config.debug_logs === true || config.debug_logs === 'true';
  return config;
}

/**
 * Whether the configuration holds enough to log in with a password.
 *
 * @param {ReturnType<typeof normalizeConfig>} config
 */
export function hasCredentials(config) {
  return Boolean(config.url && config.username && config.password);
}
