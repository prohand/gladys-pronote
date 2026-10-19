// -----------------------------------------------------------------------------
// The read loop: read PRONOTE, publish to Gladys, wait, again.
//
// The integration reads on its own timer rather than through Gladys `onPoll`:
// one login and one pass serve every student, and the pace is the user's, in
// minutes (Gladys polls at most once a minute, far too often for a school
// server shared by the whole school).
//
// After each read:
//   - the devices are published again when the list of students changed;
//   - the states are published through `publishChangedStates`: an average that
//     did not move is not sent again (Gladys accepts 300 states a minute);
//   - the scene triggers fire for what is new (src/pronote/events.js);
//   - the transport badge says `cloud`, the connection status says connected,
//     and the widgets are asked to refresh.
//
// When the read fails, the last snapshot stays (the widgets keep showing it),
// the badge turns `unreachable` and the status carries the reason. A failure
// that waiting cannot fix — refused password, account disabled, security setup
// asked — stops the timer: retrying a refused password every few minutes is
// how PRONOTE suspends the IP address of the whole house. Saving the
// configuration, "Test the connection" or a QR code login start it again.
//
// When PRONOTE suspended the IP address or asked to slow down, the next read
// waits an hour, and the widget button and the "read now" scene action answer
// with the last error instead of calling PRONOTE: every request made during a
// suspension can extend it. Only the explicit buttons of the Configuration
// screen (through `restart`) try before the hour is over.
// -----------------------------------------------------------------------------

import { DEVICE_TRANSPORTS, createLogger } from '@gladysassistant/integration-sdk';
import { buildDiscoveredDevices, buildStates, studentDeviceId } from './devices/index.js';
import { describeError, ERROR_CODES } from './pronote/errors.js';
import { compareStudent, EVENT_DATA } from './pronote/events.js';
import { readSnapshot } from './pronote/read.js';
import { readJson, writeJson } from './storage.js';
import { SCENE_TRIGGERS } from './capabilities/scenes.js';
import { refreshWidgets } from './capabilities/widgets.js';

const logger = createLogger({ name: 'sync' });

export const SEEN_FILE = 'seen.json';

/** An unchanged value is still sent every hour, so it stays recently dated. */
const STATE_HEARTBEAT_MS = 60 * 60 * 1000;

/** The pause after PRONOTE asked to slow down or suspended the IP address. */
const SLOW_DOWN_MS = 60 * 60 * 1000;
const SLOW_DOWN_CODES = [ERROR_CODES.RATE_LIMITED, ERROR_CODES.SUSPENDED_IP];

export class PronoteSync {
  /**
   * @param {object} options
   * @param {object} options.gladys the SDK client
   * @param {import('./pronote/session.js').PronoteSession} options.session
   * @param {() => Date} [options.now]
   */
  constructor({ gladys, session, now = () => new Date() }) {
    this.gladys = gladys;
    this.session = session;
    this.now = now;
    this.config = null;
    this.snapshot = null;
    this.lastError = null;
    this.lastSuccess = null;
    this.timer = null;
    this.active = false;
    this.running = null;
    this.holdUntil = 0;
    this.publishedDevices = '';
  }

  setConfig(config) {
    this.config = config;
  }

  /** Read now, then every `refresh_interval` minutes. */
  async restart() {
    this.stop();
    this.active = true;
    const result = await this.sync({ force: true });
    this.schedule(result);
    return result;
  }

  /** Stop the timer (disconnection, shutdown). A read under way finishes. */
  stop() {
    this.active = false;
    clearTimeout(this.timer);
    this.timer = null;
  }

  schedule(result) {
    clearTimeout(this.timer);
    this.timer = null;
    if (!this.active) {
      return;
    }
    const error = result?.error;
    if (error && !error.retry) {
      logger.warn(`Reading paused until the configuration changes (${error.code})`);
      return;
    }
    const interval = this.config.refresh_interval * 60 * 1000;
    const slowDown = SLOW_DOWN_CODES.includes(error?.code);
    this.timer = setTimeout(
      async () => {
        let next;
        try {
          next = await this.sync({ force: true });
        } catch (err) {
          // Never an unhandled rejection: it would stop the container.
          logger.error('PRONOTE read loop failed', err);
        }
        this.schedule(next);
      },
      slowDown ? Math.max(interval, SLOW_DOWN_MS) : interval,
    );
    this.timer.unref?.();
  }

  /**
   * One read and its publications. Two calls at once share the same read.
   *
   * @param {{ fireEvents?: boolean, force?: boolean }} [options] `fireEvents:
   *   false` publishes the states but leaves the news to the next read (scene
   *   actions); `force` reads even while PRONOTE asked to wait (the timer and
   *   the Configuration screen buttons)
   * @returns {Promise<{ ok: boolean, snapshot: object|null, error?: object, events?: number }>}
   */
  async sync({ fireEvents = true, force = false } = {}) {
    if (!force && !this.running && this.now().getTime() < this.holdUntil) {
      return { ok: false, snapshot: this.snapshot, error: this.lastError };
    }
    this.running ??= this.run(fireEvents).finally(() => {
      this.running = null;
    });
    return this.running;
  }

  async run(fireEvents) {
    let snapshot;
    try {
      snapshot = await this.session.run((handle, api) => readSnapshot(api, handle, this.now()));
    } catch (err) {
      const error = describeError(err);
      this.lastError = error;
      this.holdUntil = SLOW_DOWN_CODES.includes(error.code)
        ? this.now().getTime() + SLOW_DOWN_MS
        : 0;
      logger.error(`PRONOTE read failed (${error.code}): ${err.name}: ${err.message}`);
      await this.publishTransports(DEVICE_TRANSPORTS.UNREACHABLE);
      await this.gladys.setConnectionStatus(false, error.message).catch(() => {});
      refreshWidgets(this.gladys);
      return { ok: false, snapshot: this.snapshot, error };
    }

    this.snapshot = snapshot;
    this.lastError = null;
    this.holdUntil = 0;
    this.lastSuccess = snapshot.read_at;
    logger.info(
      `PRONOTE read: ${snapshot.students.map((student) => student.name).join(', ') || 'no student'}`,
    );

    await this.publishDevices().catch((err) =>
      logger.warn(`Devices not published: ${err.message}`),
    );
    await this.gladys
      .publishChangedStates(buildStates(this.gladys, snapshot, this.now(), this.config), {
        heartbeat: STATE_HEARTBEAT_MS,
      })
      .catch((err) => logger.warn(`States not published: ${err.message}`));
    await this.publishTransports(DEVICE_TRANSPORTS.CLOUD);
    const events = fireEvents ? await this.fireEvents(snapshot) : 0;
    await this.gladys.setConnectionStatus(true).catch(() => {});
    refreshWidgets(this.gladys);
    return { ok: true, snapshot, events };
  }

  /** Publish the devices when the list changed (or when `force`). */
  async publishDevices(force = false) {
    const devices = buildDiscoveredDevices(this.gladys, this.snapshot);
    const signature = JSON.stringify(devices);
    if (!devices.length || (!force && signature === this.publishedDevices)) {
      return;
    }
    await this.gladys.publishDiscoveredDevices(devices);
    this.publishedDevices = signature;
  }

  async publishTransports(transport) {
    const devices = buildDiscoveredDevices(this.gladys, this.snapshot);
    if (!devices.length) {
      return;
    }
    await this.gladys
      .publishTransports(devices.map((device) => ({ external_id: device.external_id, transport })))
      .catch((err) => logger.warn(`Transports not published: ${err.message}`));
  }

  /** Fire the scene triggers for what is new, and remember it. */
  async fireEvents(snapshot) {
    const previous = (await readJson(SEEN_FILE, {})) ?? {};
    // Only the students of this read are kept: the memory stays one read big.
    const seen = {};
    const now = this.now();
    let fired = 0;
    for (const student of snapshot.students) {
      const device = studentDeviceId(this.gladys, snapshot, student);
      const result = compareStudent(previous[device], student, now);
      seen[device] = result.seen;
      if (result.dropped) {
        logger.warn(`${result.dropped} news of ${student.name} not announced (too many at once)`);
      }
      for (const [kind, items] of Object.entries(result.news)) {
        for (const item of items) {
          const data = { device, student_name: student.name, ...EVENT_DATA[kind](item) };
          try {
            await this.gladys.publishSceneEvent(SCENE_TRIGGERS[kind], data);
            fired += 1;
          } catch (err) {
            logger.warn(`Scene trigger ${SCENE_TRIGGERS[kind]} not fired: ${err.message}`);
          }
        }
      }
    }
    await writeJson(SEEN_FILE, seen);
    if (fired) {
      logger.info(`${fired} scene trigger(s) fired`);
    }
    return fired;
  }
}
