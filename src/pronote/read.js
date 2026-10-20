// -----------------------------------------------------------------------------
// Read what Gladys shows from PRONOTE, into a plain snapshot.
//
// One read = one pass over every student of the account (a parent account has
// one per child): grades of the current period, homework and timetable of the
// next weeks, absences, delays and the notes of the correspondence book
// ("carnet de correspondance"), and the unread messages of the account. The snapshot holds plain values only (strings, numbers, ISO
// dates): devices, scene triggers and widgets are all computed from it, and
// the tests build one by hand.
//
// A part PRONOTE does not offer (a tab the school disabled) or fails to give
// is `null`: its features are not published this time and its scene trigger is
// not compared, rather than read as "everything was deleted". An error about
// the whole connection is not swallowed: an expired session goes up to
// `PronoteSession.run`, which logs in again and starts the read over; a
// suspended IP address or a "slow down" stops the read at once and goes up to
// the read loop, which waits.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { addDays, contentKey, formatPoints, iso, startOfDay, stripHtml } from './format.js';
import { stopsTheRead } from './errors.js';

const logger = createLogger({ name: 'read' });

/**
 * How far ahead the timetable is read: three weeks plus today, so that the
 * next school day is found across two weeks of holidays (Toussaint, Christmas,
 * winter, spring). One request whatever the length.
 */
export const TIMETABLE_HORIZON_DAYS = 22;
/**
 * How far ahead the homework is read: the homework shown is counted from the
 * next school day (src/pronote/derive.js), so the longest window is the
 * timetable read plus the largest homework horizon (21 days).
 */
export const HOMEWORK_HORIZON_DAYS = TIMETABLE_HORIZON_DAYS + 21;

/** PRONOTE's tab numbers (pawnote TabLocation). */
const TABS = { GRADES: 198, NOTEBOOK: 19 };

/** PRONOTE's grade kinds (pawnote GradeKind) that are not a mark. */
const GRADE_KIND_LABELS = {
  1: 'Abs',
  2: 'Disp',
  3: 'N.Not',
  4: 'Inapte',
  5: 'N.Rdu',
  6: 'Abs 0',
  7: 'N.Rdu 0',
  8: 'Félicitations',
};
/** Kinds that count as a zero in the average. */
const ZERO_KINDS = [6, 7];

/** PRONOTE's kinds of correspondence book notes (pawnote NotebookObservationKind). */
export const OBSERVATION_KINDS = {
  0: 'issue',
  1: 'observation',
  2: 'encouragement',
  3: 'other',
};

/**
 * The period to read: the one PRONOTE opens by default when it covers today,
 * else the shortest one covering today (a term rather than the year), else
 * the default one, else the last one.
 *
 * @param {{ defaultPeriod?: object, periods?: object[] } | undefined} tab
 * @param {Date} now
 */
export function currentPeriod(tab, now) {
  if (!tab) {
    return null;
  }
  const covers = (period) => period && period.startDate <= now && now <= period.endDate;
  if (covers(tab.defaultPeriod)) {
    return tab.defaultPeriod;
  }
  const covering = (tab.periods ?? [])
    .filter(covers)
    .sort((a, b) => a.endDate - a.startDate - (b.endDate - b.startDate));
  return covering[0] ?? tab.defaultPeriod ?? tab.periods?.at(-1) ?? null;
}

/** The number of a GradeValue, `null` when it is not a mark. */
export function gradePoints(value) {
  if (!value) {
    return null;
  }
  if (value.kind === 0) {
    return value.points;
  }
  return ZERO_KINDS.includes(value.kind) ? 0 : null;
}

/** How a GradeValue reads: `15,5` or `Abs`. */
export function gradeLabel(value) {
  if (!value) {
    return '';
  }
  return value.kind === 0 ? formatPoints(value.points) : (GRADE_KIND_LABELS[value.kind] ?? '?');
}

/** One grade, plain. */
export function toGrade(grade) {
  const value = gradePoints(grade.value);
  const outOf = gradePoints(grade.outOf) ?? 20;
  const label = `${gradeLabel(grade.value)}/${formatPoints(outOf)}`;
  return {
    key: contentKey(grade.subject?.name, iso(grade.date), label, grade.comment),
    subject: grade.subject?.name ?? '',
    value,
    out_of: outOf,
    // The mark brought back to /20, the scale every PRONOTE average uses.
    value_20: value === null || !outOf ? null : Math.round((value / outOf) * 2000) / 100,
    label,
    date: iso(grade.date),
    coefficient: grade.coefficient ?? 1,
    comment: grade.comment ?? '',
    class_average: gradePoints(grade.average),
  };
}

/** One homework, plain. */
export function toHomework(assignment) {
  const description = stripHtml(assignment.description);
  return {
    key: contentKey(assignment.subject?.name, iso(assignment.deadline), description),
    subject: assignment.subject?.name ?? '',
    description,
    due: iso(assignment.deadline),
    done: Boolean(assignment.done),
  };
}

/** One timetable entry, plain: a lesson, an activity or a detention. */
export function toLesson(entry) {
  const subject = entry.subject?.name ?? entry.title ?? (entry.is === 'detention' ? 'Retenue' : '');
  return {
    key: contentKey(subject, iso(entry.startDate)),
    kind: entry.is ?? 'lesson',
    subject,
    start: iso(entry.startDate),
    end: iso(entry.endDate),
    rooms: entry.classrooms ?? [],
    teachers: entry.teacherNames ?? [],
    canceled: Boolean(entry.canceled),
    exempted: Boolean(entry.exempted),
    test: Boolean(entry.test),
    status: entry.status ?? '',
  };
}

/** One note of the correspondence book, plain: a teacher's word to the family. */
export function toObservation(observation) {
  const comment = stripHtml(observation.reason);
  return {
    key: contentKey('observation', iso(observation.date), observation.name, comment),
    date: iso(observation.date),
    title: observation.name ?? '',
    kind: OBSERVATION_KINDS[observation.kind] ?? 'other',
    subject: observation.subject?.name ?? '',
    comment,
    read: Boolean(observation.opened),
  };
}

/** The absences, delays and correspondence book notes of a notebook, plain. */
export function toNotebook(notebook) {
  return {
    absences: (notebook.absences ?? []).map((absence) => ({
      key: contentKey('absence', iso(absence.startDate), iso(absence.endDate)),
      start: iso(absence.startDate),
      end: iso(absence.endDate),
      justified: Boolean(absence.justified),
      reason: absence.reason ?? '',
    })),
    delays: (notebook.delays ?? []).map((delay) => ({
      key: contentKey('delay', iso(delay.date), delay.minutes),
      date: iso(delay.date),
      minutes: delay.minutes ?? 0,
      justified: Boolean(delay.justified),
      reason: delay.reason ?? '',
    })),
    observations: (notebook.observations ?? [])
      .map(toObservation)
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')),
  };
}

/**
 * Run one part of the read: `null` when the part fails for a reason of its
 * own, the error itself when the whole connection is at stake.
 */
async function part(name, student, fn) {
  try {
    return await fn();
  } catch (err) {
    if (stopsTheRead(err)) {
      throw err;
    }
    logger.warn(`Cannot read the ${name} of ${student}: ${err.name}: ${err.message}`);
    return null;
  }
}

/**
 * Read one student. `api.use` points the session at them first: on a parent
 * account it is how pawnote chooses the child.
 */
async function readStudent(api, handle, resource, now) {
  api.use(handle, resource);
  const today = startOfDay(now);
  const name = resource.name;

  const grades = await part('grades', name, async () => {
    const period = currentPeriod(resource.tabs?.get?.(TABS.GRADES), now);
    if (!period) {
      return null;
    }
    const overview = await api.gradesOverview(handle, period);
    return {
      period: period.name,
      average: gradePoints(overview.overallAverage),
      class_average: gradePoints(overview.classAverage),
      list: (overview.grades ?? []).map(toGrade),
    };
  });

  const homework = await part('homework', name, async () => {
    const list = await api.assignmentsFromIntervals(
      handle,
      today,
      addDays(today, HOMEWORK_HORIZON_DAYS),
    );
    return list.map(toHomework).sort((a, b) => a.due.localeCompare(b.due));
  });

  const lessons = await part('timetable', name, async () => {
    const timetable = await api.timetableFromIntervals(
      handle,
      today,
      addDays(today, TIMETABLE_HORIZON_DAYS),
    );
    // PRONOTE's own way to show a week: canceled lessons kept, unless another
    // lesson took their slot (a replacement teacher, a moved class).
    api.parseTimetable(handle, timetable, {
      withCanceledClasses: true,
      withSuperposedCanceledClasses: false,
      withPlannedClasses: true,
    });
    return timetable.classes.map(toLesson).sort((a, b) => a.start.localeCompare(b.start));
  });

  const notebook = await part('absences', name, async () => {
    const period = currentPeriod(resource.tabs?.get?.(TABS.NOTEBOOK), now);
    return period ? toNotebook(await api.notebook(handle, period)) : null;
  });

  return {
    // PRONOTE's id is only used inside one session; the device is keyed on
    // what stays: the server and the student's name (see src/devices/).
    name,
    class_name: resource.className ?? '',
    establishment: resource.establishmentName ?? '',
    grades,
    homework,
    lessons,
    absences: notebook?.absences ?? null,
    delays: notebook?.delays ?? null,
    observations: notebook?.observations ?? null,
  };
}

/** The unread messages of the account, `null` when it cannot read them. */
async function readUnread(api, handle) {
  if (!handle.user?.authorizations?.canReadDiscussions) {
    return null;
  }
  return part('messages', handle.user.name, async () => {
    const { items } = await api.discussions(handle);
    return items.reduce((sum, item) => sum + (item.numberOfMessagesUnread ?? 0), 0);
  });
}

/**
 * Read everything Gladys shows.
 *
 * @param {object} api the pawnote module
 * @param {object} handle a logged-in pawnote session
 * @param {Date} [now]
 */
export async function readSnapshot(api, handle, now = new Date()) {
  const students = [];
  for (const resource of handle.user?.resources ?? []) {
    students.push(await readStudent(api, handle, resource, now));
  }
  return {
    read_at: now.toISOString(),
    account: {
      url: handle.information?.url ?? '',
      name: handle.user?.name ?? '',
      kind: handle.information?.accountKind ?? null,
      unread_messages: await readUnread(api, handle),
    },
    students,
  };
}
