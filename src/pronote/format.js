// -----------------------------------------------------------------------------
// Small pure helpers shared by the readers, the devices and the capabilities.
//
// Every date here is read in the process time zone, which src/logging.js sets to
// the school's (PRONOTE writes "08:00" without saying where): `dayKey` and
// `timeOf` therefore give back what PRONOTE showed, in any container.
// -----------------------------------------------------------------------------

import { createHash } from 'node:crypto';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Midnight of the day of `date`, local time. */
export function startOfDay(date) {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
}

/** `date` moved by whole days, local time (a DST change keeps midnight). */
export function addDays(date, days) {
  const moved = new Date(date);
  moved.setDate(moved.getDate() + days);
  return moved;
}

/** `YYYY-MM-DD` of `date`, local time. */
export function dayKey(date) {
  const day = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

/** `HH:MM` of `date`, local time. */
export function timeOf(date) {
  const day = new Date(date);
  return `${String(day.getHours()).padStart(2, '0')}:${String(day.getMinutes()).padStart(2, '0')}`;
}

/** `DD/MM` of `date`, local time: the short form every language here reads. */
export function shortDate(date) {
  const day = new Date(date);
  return `${String(day.getDate()).padStart(2, '0')}/${String(day.getMonth() + 1).padStart(2, '0')}`;
}

/** Whole days from the day of `from` to the day of `to` (0 = same day). */
export function daysBetween(from, to) {
  return Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS);
}

/** The ISO string of a Date, `null` for anything that is not a valid date. */
export function iso(date) {
  const value = date instanceof Date ? date : new Date(date);
  return Number.isNaN(value.getTime()) ? null : value.toISOString();
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/**
 * Plain text of the HTML PRONOTE stores homework in: tags dropped, line
 * breaks kept, entities decoded, blank runs squeezed.
 *
 * @param {string} html
 */
export function stripHtml(html) {
  return String(html ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h\d)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
      if (entity[0] === '#') {
        const code =
          entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      return ENTITIES[entity.toLowerCase()] ?? match;
    })
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/** `text` cut to `max` characters, with an ellipsis when it was longer. */
export function truncate(text, max) {
  const value = String(text ?? '');
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

/**
 * A short stable key for a thing PRONOTE describes. PRONOTE's own ids (`N`)
 * are not guaranteed to survive a new session, so what was already seen is
 * remembered by content instead.
 *
 * @param {...unknown} parts
 */
export function contentKey(...parts) {
  return createHash('sha256')
    .update(parts.map((part) => String(part ?? '')).join('\u0000'))
    .digest('hex')
    .slice(0, 16);
}

/** A number written the French way PRONOTE uses: `15,5`, `12`. */
export function formatPoints(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '';
  }
  return String(Math.round(value * 100) / 100).replace('.', ',');
}
