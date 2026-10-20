// -----------------------------------------------------------------------------
// Dashboard widgets (Gladys 5.1+).
//
//   - `student`: one student at a glance — average, homework to do, absences,
//     the next lesson, the last grade, the unread messages, and one list: the
//     homework (done or not), the last grades or the correspondence book, as
//     the widget's `list` setting says (a widget shows one list at most: add
//     the widget several times to see several). A button reads PRONOTE now.
//   - `timetable`: the lessons of one day (today, tomorrow or the next school
//     day), canceled lessons and tests flagged.
//
// Both answer from the last read: opening a dashboard never calls PRONOTE.
// The values are computed rather than bound to the device features, so a
// widget works before the user created the devices; src/sync.js nudges the
// widgets after every read instead.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS, createLogger } from '@gladysassistant/integration-sdk';
import { findStudent } from '../devices/index.js';
import {
  DAYS,
  daySummary,
  gradeLine,
  homeworkShown,
  lastGrade,
  lessonLine,
  nextLesson,
  nextSchoolDay,
  recentGrades,
} from '../pronote/derive.js';
import { addDays, dayKey, formatPoints, timeOf, truncate } from '../pronote/format.js';
import { localeOf, pick } from '../i18n.js';

const logger = createLogger({ name: 'widgets' });

/** Widget keys, as declared in the manifest. Never rename. */
export const WIDGET_KEYS = { STUDENT: 'student', TIMETABLE: 'timetable' };

/** What the list of the `student` widget shows (its `list` setting). Never rename. */
export const STUDENT_LISTS = { HOMEWORK: 'homework', GRADES: 'grades', NOTEBOOK: 'notebook' };

/** A card-list holds 8 rows at most. */
const LIST_SIZE = 8;

/** Button action keys of the widget contents. */
export const WIDGET_ACTIONS = { REFRESH: 'refresh' };

const T = {
  waiting: {
    en: 'Waiting for the first PRONOTE read.',
    fr: 'En attente de la première lecture de PRONOTE.',
    de: 'Warten auf den ersten PRONOTE-Abruf.',
    es: 'Esperando la primera lectura de PRONOTE.',
  },
  noStudent: {
    en: 'This student is not on the PRONOTE account.',
    fr: 'Cet élève n’est pas sur le compte PRONOTE.',
    de: 'Dieser Schüler ist nicht im PRONOTE-Konto.',
    es: 'Este alumno no está en la cuenta de PRONOTE.',
  },
  average: { en: 'Average', fr: 'Moyenne', de: 'Durchschnitt', es: 'Media' },
  homework: { en: 'Homework', fr: 'Devoirs', de: 'Hausaufgaben', es: 'Deberes' },
  absences: { en: 'Absences', fr: 'Absences', de: 'Fehlzeiten', es: 'Ausencias' },
  nextLesson: {
    en: 'Next lesson',
    fr: 'Prochain cours',
    de: 'Nächste Stunde',
    es: 'Próxima clase',
  },
  nextDay: {
    en: 'Next school day',
    fr: 'Prochain jour de cours',
    de: 'Nächster Schultag',
    es: 'Próximo día de clase',
  },
  lastGrade: { en: 'Last grade', fr: 'Dernière note', de: 'Letzte Note', es: 'Última nota' },
  unread: {
    en: 'Unread messages',
    fr: 'Messages non lus',
    de: 'Ungelesene Nachrichten',
    es: 'Mensajes no leídos',
  },
  connection: { en: 'PRONOTE', fr: 'PRONOTE', de: 'PRONOTE', es: 'PRONOTE' },
  refresh: { en: 'Refresh', fr: 'Actualiser', de: 'Aktualisieren', es: 'Actualizar' },
  refreshed: {
    en: 'PRONOTE read again.',
    fr: 'PRONOTE relu.',
    de: 'PRONOTE erneut abgerufen.',
    es: 'PRONOTE leído de nuevo.',
  },
  due: { en: 'Due', fr: 'Pour le', de: 'Fällig am', es: 'Para el' },
  today: { en: 'Today', fr: 'Aujourd’hui', de: 'Heute', es: 'Hoy' },
  tomorrow: { en: 'Tomorrow', fr: 'Demain', de: 'Morgen', es: 'Mañana' },
  noHomework: {
    en: 'No homework to do.',
    fr: 'Aucun devoir à faire.',
    de: 'Keine Hausaufgaben.',
    es: 'No hay deberes.',
  },
  done: { en: 'Done', fr: 'Fait', de: 'Erledigt', es: 'Hecho' },
  notDone: { en: 'Not done', fr: 'Non fait', de: 'Offen', es: 'Pendiente' },
  classAverage: { en: 'Class', fr: 'Classe', de: 'Klasse', es: 'Clase' },
  coefficient: { en: 'Coefficient', fr: 'Coefficient', de: 'Gewichtung', es: 'Coeficiente' },
  noGrade: {
    en: 'No grade this period.',
    fr: 'Aucune note sur la période.',
    de: 'Keine Note in diesem Zeitraum.',
    es: 'Ninguna nota en este periodo.',
  },
  noObservation: {
    en: 'No note in the correspondence book.',
    fr: 'Aucun mot dans le carnet de correspondance.',
    de: 'Keine Notiz im Mitteilungsheft.',
    es: 'Ninguna nota en la libreta de correspondencia.',
  },
  observationKinds: {
    issue: { en: 'Book issue', fr: 'Défaut carnet', de: 'Heftmangel', es: 'Falta libreta' },
    observation: { en: 'Observation', fr: 'Observation', de: 'Bemerkung', es: 'Observación' },
    encouragement: { en: 'Praise', fr: 'Encouragement', de: 'Lob', es: 'Ánimo' },
    other: { en: 'Note', fr: 'Mot', de: 'Notiz', es: 'Nota' },
  },
  noLesson: {
    en: 'No lesson on this day.',
    fr: 'Pas de cours ce jour-là.',
    de: 'Kein Unterricht an diesem Tag.',
    es: 'No hay clases ese día.',
  },
  noSchoolDay: {
    en: 'No school day in the next three weeks.',
    fr: 'Pas de jour de cours dans les trois semaines à venir.',
    de: 'Kein Schultag in den nächsten drei Wochen.',
    es: 'No hay día de clase en las próximas tres semanas.',
  },
  canceled: { en: 'Canceled', fr: 'Annulé', de: 'Entfällt', es: 'Cancelada' },
  test: { en: 'Test', fr: 'Contrôle', de: 'Test', es: 'Examen' },
  exempted: { en: 'Exempted', fr: 'Dispensé', de: 'Befreit', es: 'Exento' },
  lessons: { en: 'Lessons', fr: 'Cours', de: 'Stunden', es: 'Clases' },
  start: { en: 'Start', fr: 'Début', de: 'Beginn', es: 'Inicio' },
  end: { en: 'End', fr: 'Fin', de: 'Ende', es: 'Fin' },
};

/** A day, written the way the reader's language writes it: `Tue 15/10`. */
function dayLabel(day, language) {
  const date = new Date(`${day}T12:00:00`);
  const weekday = new Intl.DateTimeFormat(localeOf(language), { weekday: 'short' }).format(date);
  return `${weekday} ${day.slice(8, 10)}/${day.slice(5, 7)}`;
}

/** A day as a heading: `Tuesday 15 October`. */
function dayHeading(day, language) {
  return new Intl.DateTimeFormat(localeOf(language), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${day}T12:00:00`));
}

/** The content shown when there is nothing to show yet. */
function emptyContent(sync, language, text) {
  const components = [{ type: 'text', text }];
  if (sync.lastError) {
    components.push({
      type: 'status',
      items: [
        {
          label: T.connection,
          icon: 'alert-triangle',
          value: truncate(pick(language, sync.lastError.message), 40),
          color: WIDGET_COLORS.DANGER,
        },
      ],
    });
  }
  return { ttl_seconds: 60, components };
}

/** The color of a grade badge, from the mark brought back to /20. */
function gradeColor(grade) {
  if (grade.value_20 === null) {
    return WIDGET_COLORS.NEUTRAL;
  }
  if (grade.value_20 >= 14) {
    return WIDGET_COLORS.SUCCESS;
  }
  return grade.value_20 >= 10 ? WIDGET_COLORS.INFO : WIDGET_COLORS.WARNING;
}

const OBSERVATION_COLORS = {
  issue: WIDGET_COLORS.WARNING,
  observation: WIDGET_COLORS.INFO,
  encouragement: WIDGET_COLORS.SUCCESS,
  other: WIDGET_COLORS.NEUTRAL,
};

/**
 * The homework list: done and not done, like PRONOTE's "homework for the next
 * days". When it does not fit, what is done gives way first.
 */
function homeworkList(shown, now, language) {
  if (!shown.length) {
    return { type: 'text', variant: 'caption', text: T.noHomework };
  }
  const today = dayKey(now);
  const tomorrow = dayKey(addDays(now, 1));
  const rows = shown.length > LIST_SIZE ? shown.filter((item) => !item.done) : shown;
  return {
    type: 'card-list',
    display: 'list',
    items: (rows.length ? rows : shown).slice(0, LIST_SIZE).map((item) => {
      const due = dayKey(item.due);
      const badge = item.done
        ? { text: pick(language, T.done), color: WIDGET_COLORS.SUCCESS }
        : due === today
          ? { text: pick(language, T.today), color: WIDGET_COLORS.DANGER }
          : due === tomorrow
            ? { text: pick(language, T.tomorrow), color: WIDGET_COLORS.WARNING }
            : { text: pick(language, T.notDone), color: WIDGET_COLORS.NEUTRAL };
      return {
        title: truncate(item.subject, 60),
        subtitle: `${pick(language, T.due)} ${dayLabel(due, language)}`,
        badge,
        description: truncate(item.description || '—', 2000),
      };
    }),
  };
}

/** The last grades, the most recent first. */
function gradesList(student, language) {
  const grades = recentGrades(student, LIST_SIZE);
  if (!grades.length) {
    return { type: 'text', variant: 'caption', text: T.noGrade };
  }
  return {
    type: 'card-list',
    display: 'list',
    items: grades.map((grade) => {
      const details = [grade.date ? dayLabel(dayKey(grade.date), language) : null];
      if (grade.class_average !== null) {
        details.push(`${pick(language, T.classAverage)} ${formatPoints(grade.class_average)}`);
      }
      const description = [
        grade.comment,
        `${pick(language, T.coefficient)} ${formatPoints(grade.coefficient)}`,
      ].filter(Boolean);
      return {
        title: truncate(grade.subject, 60),
        subtitle: truncate(details.filter(Boolean).join(' · '), 60),
        badge: { text: truncate(grade.label, 16), color: gradeColor(grade) },
        description: truncate(description.join('\n'), 2000),
      };
    }),
  };
}

/** The notes of the correspondence book, the most recent first. */
function notebookList(student, language) {
  const notes = student.observations.slice(0, LIST_SIZE);
  if (!notes.length) {
    return { type: 'text', variant: 'caption', text: T.noObservation };
  }
  return {
    type: 'card-list',
    display: 'list',
    items: notes.map((note) => {
      const kind = T.observationKinds[note.kind] ?? T.observationKinds.other;
      const details = [note.date ? dayLabel(dayKey(note.date), language) : null, note.subject];
      return {
        title: truncate(note.title || pick(language, kind), 60),
        subtitle: truncate(details.filter(Boolean).join(' · '), 60),
        badge: { text: truncate(pick(language, kind), 16), color: OBSERVATION_COLORS[note.kind] },
        description: truncate(note.comment || '—', 2000),
      };
    }),
  };
}

/** The list the `student` widget shows, `null` when PRONOTE did not give it. */
function studentList(student, which, shown, now, language) {
  if (which === STUDENT_LISTS.GRADES) {
    return student.grades ? gradesList(student, language) : null;
  }
  if (which === STUDENT_LISTS.NOTEBOOK) {
    return student.observations ? notebookList(student, language) : null;
  }
  return student.homework ? homeworkList(shown, now, language) : null;
}

const REFRESH_BUTTON = {
  type: 'button',
  label: T.refresh,
  icon: 'refresh-cw',
  style: 'secondary',
  action: { key: WIDGET_ACTIONS.REFRESH },
};

/** The `student` widget content. */
export function studentContent(gladys, sync, { settings = {}, language = 'en' }) {
  const snapshot = sync.snapshot;
  if (!snapshot) {
    return emptyContent(sync, language, T.waiting);
  }
  const student = findStudent(gladys, snapshot, settings.student);
  if (!student) {
    return emptyContent(sync, language, T.noStudent);
  }
  const now = sync.now();
  const shown = homeworkShown(student, now, sync.config?.homework_days ?? 7);
  const todo = shown.filter((item) => !item.done);
  const which = Object.values(STUDENT_LISTS).includes(settings.list)
    ? settings.list
    : STUDENT_LISTS.HOMEWORK;

  const components = [{ type: 'text', variant: 'heading', text: truncate(student.name, 40) }];
  if (student.grades?.average !== null && student.grades?.average !== undefined) {
    components.push({
      type: 'value',
      label: T.average,
      icon: 'award',
      value: formatPoints(student.grades.average),
      unit: '/20',
    });
  }
  if (student.homework) {
    components.push({ type: 'value', label: T.homework, icon: 'book', value: todo.length });
  }
  if (student.absences) {
    components.push({
      type: 'value',
      label: T.absences,
      icon: 'user-x',
      value: student.absences.length,
    });
  }

  const list = studentList(student, which, shown, now, language);
  if (list) {
    components.push(list);
  }

  const items = [];
  if (student.lessons) {
    items.push({
      label: T.nextLesson,
      icon: 'clock',
      value: truncate(lessonLine(nextLesson(student, now), now), 40),
      color: WIDGET_COLORS.PRIMARY,
    });
    const day = nextSchoolDay(student, now);
    const first = day ? daySummary(student, DAYS.NEXT_SCHOOL_DAY, now).first : null;
    items.push({
      label: T.nextDay,
      icon: 'sunrise',
      value: first ? `${dayLabel(day, language)} ${timeOf(first.start)}` : '—',
      color: WIDGET_COLORS.NEUTRAL,
    });
  }
  if (student.grades) {
    items.push({
      label: T.lastGrade,
      icon: 'edit-3',
      value: truncate(gradeLine(lastGrade(student)), 40),
      color: WIDGET_COLORS.INFO,
    });
  }
  if (typeof snapshot.account.unread_messages === 'number') {
    items.push({
      label: T.unread,
      icon: 'mail',
      value: snapshot.account.unread_messages,
      color: snapshot.account.unread_messages ? WIDGET_COLORS.WARNING : WIDGET_COLORS.SUCCESS,
    });
  }
  if (sync.lastError) {
    items.push({
      label: T.connection,
      icon: 'alert-triangle',
      value: truncate(pick(language, sync.lastError.message), 40),
      color: WIDGET_COLORS.DANGER,
    });
  }
  if (items.length) {
    components.push({ type: 'status', items: items.slice(0, 10) });
  }
  components.push(REFRESH_BUTTON);
  return { ttl_seconds: 600, components };
}

/** The `timetable` widget content. */
export function timetableContent(gladys, sync, { settings = {}, language = 'en' }) {
  const snapshot = sync.snapshot;
  if (!snapshot) {
    return emptyContent(sync, language, T.waiting);
  }
  const student = findStudent(gladys, snapshot, settings.student);
  if (!student) {
    return emptyContent(sync, language, T.noStudent);
  }
  const which = Object.values(DAYS).includes(settings.day) ? settings.day : DAYS.NEXT_SCHOOL_DAY;
  const summary = daySummary(student, which, sync.now());
  if (!summary.date) {
    return {
      ttl_seconds: 600,
      components: [
        { type: 'text', variant: 'heading', text: truncate(student.name, 40) },
        { type: 'text', variant: 'caption', text: T.noSchoolDay },
      ],
    };
  }
  const components = [
    {
      type: 'text',
      variant: 'heading',
      text: truncate(`${student.name.split(' ')[0]} · ${dayHeading(summary.date, language)}`, 40),
    },
  ];
  if (!summary.lessons.length) {
    components.push({ type: 'text', variant: 'caption', text: T.noLesson });
    return { ttl_seconds: 600, components };
  }
  components.push(
    { type: 'value', label: T.lessons, icon: 'calendar', value: summary.held.length },
    {
      type: 'value',
      label: T.start,
      icon: 'sunrise',
      value: summary.first ? timeOf(summary.first.start) : '—',
    },
    {
      type: 'value',
      label: T.end,
      icon: 'sunset',
      value: summary.last ? timeOf(summary.last.end) : '—',
    },
    {
      type: 'card-list',
      display: 'list',
      items: summary.lessons.slice(0, 8).map((lesson) => {
        const badge = lesson.canceled
          ? { text: pick(language, T.canceled), color: WIDGET_COLORS.DANGER }
          : lesson.test
            ? { text: pick(language, T.test), color: WIDGET_COLORS.WARNING }
            : lesson.exempted
              ? { text: pick(language, T.exempted), color: WIDGET_COLORS.INFO }
              : null;
        const details = [...lesson.rooms, ...lesson.teachers, lesson.status].filter(Boolean);
        return {
          title: truncate(`${timeOf(lesson.start)}–${timeOf(lesson.end)} ${lesson.subject}`, 60),
          ...(details.length && { subtitle: truncate(details.join(' · '), 80) }),
          ...(badge && { badge }),
        };
      }),
    },
    REFRESH_BUTTON,
  );
  return { ttl_seconds: 600, components };
}

/**
 * The widget handlers, keyed by widget key.
 *
 * @param {import('../sync.js').PronoteSync} sync
 * @param {object} gladys
 */
export function widgetHandlers(sync, gladys) {
  const refresh = async (actionKey) => {
    logger.info(`Widget action ${actionKey}`);
    if (actionKey !== WIDGET_ACTIONS.REFRESH) {
      throw new Error(`Unknown widget action: ${actionKey}`);
    }
    // Like the scene action: the news are left to the next timed read.
    const result = await sync.sync({ fireEvents: false });
    return result.ok ? T.refreshed : result.error.message;
  };
  return {
    [WIDGET_KEYS.STUDENT]: {
      get: async (request) => studentContent(gladys, sync, request),
      action: refresh,
    },
    [WIDGET_KEYS.TIMETABLE]: {
      get: async (request) => timetableContent(gladys, sync, request),
      action: refresh,
    },
  };
}

/**
 * Ask the core to re-pull every widget now: called after every read. Rate
 * limited core-side and dropped while disconnected, so never awaited.
 */
export function refreshWidgets(gladys) {
  for (const key of Object.values(WIDGET_KEYS)) {
    gladys.requestWidgetRefresh(key);
  }
}
