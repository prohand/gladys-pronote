// -----------------------------------------------------------------------------
// What is new since the last read: the grades, homework, canceled lessons and
// absences that were not there before.
//
// PRONOTE has no notifications to subscribe to: the integration compares each
// read with what it already saw, remembered by content key per student (see
// contentKey) in /data/seen.json, so a restart does not announce everything
// again.
//
// The rules:
//   - the first read of a student only remembers: a new install does not fire a
//     trigger for every grade of the term;
//   - a part PRONOTE did not give (`null`) keeps what was remembered: a failed
//     read is not "everything is new" at the next one;
//   - what disappears is forgotten (a homework past its date, a lesson gone
//     from the window), so the memory stays the size of one read;
//   - at most MAX_PER_KIND events per kind and per read: a teacher importing a
//     whole term of grades does not start fifty scenes.
// -----------------------------------------------------------------------------

import { dayKey, timeOf } from './format.js';

export const MAX_PER_KIND = 10;

/** The kinds of things compared, and how to pick them from a student. */
export const KINDS = {
  grades: (student) => student.grades?.list ?? null,
  homework: (student) => student.homework,
  cancellations: (student, now) =>
    student.lessons?.filter((lesson) => lesson.canceled && new Date(lesson.start) > now) ?? null,
  absences: (student) =>
    student.absences && student.delays
      ? [
          ...student.absences.map((item) => ({ ...item, type: 'absence' })),
          ...student.delays.map((item) => ({ ...item, type: 'delay' })),
        ]
      : null,
};

/**
 * Compare one student with what was seen of them.
 *
 * @param {Record<string, string[]> | undefined} seen what was seen, per kind
 * @param {object} student a snapshot student
 * @param {Date} now
 * @returns {{ seen: Record<string, string[]>, news: Record<string, object[]>, dropped: number }}
 */
export function compareStudent(seen, student, now) {
  const next = { ...(seen ?? {}) };
  const news = {};
  let dropped = 0;
  for (const [kind, select] of Object.entries(KINDS)) {
    const items = select(student, now);
    if (!items) {
      continue;
    }
    const known = seen?.[kind];
    if (known) {
      const old = new Set(known);
      const fresh = items.filter((item) => !old.has(item.key));
      news[kind] = fresh.slice(0, MAX_PER_KIND);
      dropped += Math.max(0, fresh.length - MAX_PER_KIND);
    }
    next[kind] = items.map((item) => item.key);
  }
  return { seen: next, news, dropped };
}

/** The flat scene event `data` of each kind (see the manifest `variables`). */
export const EVENT_DATA = {
  grades: (grade) => ({
    subject: grade.subject,
    grade: grade.value,
    out_of: grade.out_of,
    grade_20: grade.value_20,
    grade_label: grade.label,
    coefficient: grade.coefficient,
    class_average: grade.class_average,
    comment: grade.comment.slice(0, 1000),
    date: grade.date ? dayKey(grade.date) : null,
  }),
  homework: (item) => ({
    subject: item.subject,
    description: item.description.slice(0, 1000),
    due_date: dayKey(item.due),
  }),
  cancellations: (lesson) => ({
    subject: lesson.subject,
    date: dayKey(lesson.start),
    start_time: timeOf(lesson.start),
    end_time: timeOf(lesson.end),
    status: lesson.status,
  }),
  absences: (item) => ({
    kind: item.type,
    date: dayKey(item.start ?? item.date),
    justified: item.justified ? 'yes' : 'no',
    minutes: item.type === 'delay' ? item.minutes : null,
    reason: item.reason.slice(0, 1000),
  }),
};
