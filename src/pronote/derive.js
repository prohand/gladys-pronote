// -----------------------------------------------------------------------------
// What the snapshot means today: the next lesson, the next school day, the
// homework still to do. Pure functions of (student, now), shared by the device
// states, the widgets and the scene actions so they never disagree.
// -----------------------------------------------------------------------------

import { addDays, dayKey, shortDate, startOfDay, timeOf } from './format.js';

/** The days a scene action or a widget can ask about. */
export const DAYS = { TODAY: 'today', TOMORROW: 'tomorrow', NEXT_SCHOOL_DAY: 'next_school_day' };

/** Lessons that take place: not canceled. */
function held(lessons) {
  return (lessons ?? []).filter((lesson) => !lesson.canceled);
}

/** The lessons of one day (`YYYY-MM-DD`), canceled ones included. */
export function lessonsOn(student, day) {
  return (student.lessons ?? []).filter((lesson) => dayKey(lesson.start) === day);
}

/**
 * The first day after today with a lesson that takes place, `null` when the
 * timetable read shows none (holidays, or a timetable the school hides).
 */
export function nextSchoolDay(student, now) {
  const today = dayKey(now);
  const lesson = held(student.lessons).find((entry) => dayKey(entry.start) > today);
  return lesson ? dayKey(lesson.start) : null;
}

/** The `YYYY-MM-DD` a DAYS value stands for, `null` when unknown. */
export function resolveDay(student, which, now) {
  if (which === DAYS.TODAY) {
    return dayKey(now);
  }
  if (which === DAYS.TOMORROW) {
    const tomorrow = startOfDay(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return dayKey(tomorrow);
  }
  return nextSchoolDay(student, now);
}

/** The next lesson that takes place and has not started yet. */
export function nextLesson(student, now) {
  return held(student.lessons).find((lesson) => new Date(lesson.start) > now) ?? null;
}

/** How a lesson reads on one line: `08:00 Mathématiques (B12)`. */
export function lessonLine(lesson, now) {
  if (!lesson) {
    return '—';
  }
  const room = lesson.rooms?.length ? ` (${lesson.rooms.join(', ')})` : '';
  const day = dayKey(lesson.start) === dayKey(now) ? '' : `${shortDate(lesson.start)} `;
  return `${day}${timeOf(lesson.start)} ${lesson.subject}${room}`;
}

/** Homework not done yet, due today or later. */
export function pendingHomework(student, now) {
  const today = dayKey(now);
  return (student.homework ?? []).filter((item) => !item.done && dayKey(item.due) >= today);
}

/**
 * The last day (`YYYY-MM-DD`) of the homework shown: `days` days counted from
 * the next school day. On a school week that is `days` days from today; during
 * the holidays the window starts at the return, as PRONOTE's "homework for the
 * next days" does, rather than showing nothing until the last week.
 */
export function homeworkUntil(student, now, days) {
  const tomorrow = dayKey(addDays(now, 1));
  const next = nextSchoolDay(student, now);
  const first = next && next > tomorrow ? next : tomorrow;
  return dayKey(addDays(new Date(`${first}T12:00:00`), days - 1));
}

/** The homework due from today to the end of the window, done or not. */
export function homeworkShown(student, now, days) {
  const today = dayKey(now);
  const until = homeworkUntil(student, now, days);
  return (student.homework ?? []).filter((item) => {
    const due = dayKey(item.due);
    return due >= today && due <= until;
  });
}

/** Homework due on one day (`YYYY-MM-DD`). */
export function homeworkOn(student, day) {
  return (student.homework ?? []).filter((item) => dayKey(item.due) === day);
}

/** The most recent grade, `null` when there is none. */
export function lastGrade(student) {
  const list = student.grades?.list ?? [];
  return list.reduce(
    (latest, grade) => (!latest || grade.date > latest.date ? grade : latest),
    null,
  );
}

/** The most recent grades first, at most `count`. */
export function recentGrades(student, count) {
  return [...(student.grades?.list ?? [])]
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    .slice(0, count);
}

/** How a grade reads on one line: `Mathématiques 15/20 (14/10)`. */
export function gradeLine(grade) {
  return grade ? `${grade.subject} ${grade.label} (${shortDate(grade.date)})` : '—';
}

/**
 * Everything about one day of one student, for the scene action and the
 * timetable widget.
 *
 * @param {object} student a snapshot student
 * @param {string} which a DAYS value
 * @param {Date} now
 */
export function daySummary(student, which, now) {
  const day = resolveDay(student, which, now);
  if (!day) {
    return { date: '', lessons: [], held: [], canceled: [], homework: [] };
  }
  const lessons = lessonsOn(student, day);
  const taking = held(lessons);
  return {
    date: day,
    lessons,
    held: taking,
    canceled: lessons.filter((lesson) => lesson.canceled),
    first: taking[0] ?? null,
    last: taking.at(-1) ?? null,
    homework: homeworkOn(student, day),
  };
}
