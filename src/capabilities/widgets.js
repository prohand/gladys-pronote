// -----------------------------------------------------------------------------
// Dashboard widgets (Gladys 5.1+).
//
//   - `student`: one student at a glance — average, homework to do, absences,
//     the next lesson, the last grade, the unread messages, and the homework
//     list. A button reads PRONOTE now.
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
  lastGrade,
  lessonLine,
  nextLesson,
  nextSchoolDay,
  pendingHomework,
} from '../pronote/derive.js';
import { addDays, dayKey, formatPoints, timeOf, truncate } from '../pronote/format.js';
import { localeOf, pick } from '../i18n.js';

const logger = createLogger({ name: 'widgets' });

/** Widget keys, as declared in the manifest. Never rename. */
export const WIDGET_KEYS = { STUDENT: 'student', TIMETABLE: 'timetable' };

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
  noLesson: {
    en: 'No lesson on this day.',
    fr: 'Pas de cours ce jour-là.',
    de: 'Kein Unterricht an diesem Tag.',
    es: 'No hay clases ese día.',
  },
  noSchoolDay: {
    en: 'No school day in the coming week.',
    fr: 'Pas de jour de cours dans la semaine à venir.',
    de: 'Kein Schultag in der kommenden Woche.',
    es: 'No hay día de clase en la próxima semana.',
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
  const limit = dayKey(addDays(now, sync.config?.homework_days ?? 7));
  const todo = pendingHomework(student, now).filter((item) => dayKey(item.due) <= limit);
  const today = dayKey(now);
  const tomorrow = dayKey(addDays(now, 1));

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

  if (student.homework) {
    components.push(
      todo.length
        ? {
            type: 'card-list',
            display: 'list',
            items: todo.slice(0, 8).map((item) => {
              const due = dayKey(item.due);
              const soon = due === today ? T.today : due === tomorrow ? T.tomorrow : null;
              return {
                title: truncate(item.subject, 60),
                subtitle: `${pick(language, T.due)} ${dayLabel(due, language)}`,
                ...(soon && {
                  badge: {
                    text: pick(language, soon),
                    color: due === today ? WIDGET_COLORS.DANGER : WIDGET_COLORS.WARNING,
                  },
                }),
                description: truncate(item.description || '—', 2000),
              };
            }),
          }
        : { type: 'text', variant: 'caption', text: T.noHomework },
    );
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
