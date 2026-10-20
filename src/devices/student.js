// -----------------------------------------------------------------------------
// Device type: STUDENT
//
// One device per student of the account (a parent account has one per child).
// Read-only sensors: there is nothing to command on PRONOTE from a dashboard.
// The numbers keep their history (the average over the term draws a curve), the
// texts are what a dashboard or a TTS scene reads out.
// -----------------------------------------------------------------------------

import { DEVICE_FEATURE_CATEGORIES, DEVICE_FEATURE_TYPES } from '@gladysassistant/integration-sdk';
import {
  gradeLine,
  homeworkOn,
  homeworkShown,
  lastGrade,
  lessonLine,
  nextLesson,
  nextSchoolDay,
} from '../pronote/derive.js';
import { dayKey, timeOf } from '../pronote/format.js';
import { studentPlatformId } from './ids.js';

export const DEVICE_TYPE = 'student';

/** Feature keys: stored by Gladys, never rename them. */
export const FEATURES = {
  AVERAGE: 'average',
  HOMEWORK_PENDING: 'homework-pending',
  HOMEWORK_NEXT_DAY: 'homework-next-day',
  ABSENCES: 'absences',
  DELAYS: 'delays',
  NEXT_LESSON: 'next-lesson',
  NEXT_DAY_START: 'next-day-start',
  LAST_GRADE: 'last-grade',
};

const NUMBER = {
  category: DEVICE_FEATURE_CATEGORIES.UNKNOWN,
  type: DEVICE_FEATURE_TYPES.UNKNOWN.UNKNOWN,
  read_only: true,
  has_feedback: false,
  keep_history: true,
};

// Text features carry no range, but Gladys stores min/max as NOT NULL.
const TEXT = {
  category: DEVICE_FEATURE_CATEGORIES.TEXT,
  type: DEVICE_FEATURE_TYPES.TEXT.TEXT,
  read_only: true,
  has_feedback: false,
  keep_history: false,
  min: 0,
  max: 0,
};

/** The external ids of one student. */
export function studentIds(gladys, account, student) {
  return gladys.externalIds(DEVICE_TYPE, studentPlatformId(account, student));
}

/** The discovery payload of one student. */
export function buildStudentDevice(gladys, account, student) {
  const ids = studentIds(gladys, account, student);
  const feature = (key, name, shape, extra = {}) => ({
    name,
    external_id: ids.feature(key),
    ...shape,
    ...extra,
  });
  return {
    name: `PRONOTE – ${student.name}`,
    external_id: ids.device,
    // Read on the integration's own timer (src/sync.js): one PRONOTE login
    // serves every student, and the pace is the user's, in minutes.
    should_poll: false,
    params: [
      { name: 'class', value: student.class_name || '-' },
      { name: 'establishment', value: student.establishment || '-' },
    ],
    features: [
      feature(FEATURES.AVERAGE, 'Overall average', NUMBER, { min: 0, max: 20 }),
      feature(FEATURES.HOMEWORK_PENDING, 'Homework to do', NUMBER, { min: 0, max: 200 }),
      feature(FEATURES.HOMEWORK_NEXT_DAY, 'Homework for the next school day', NUMBER, {
        min: 0,
        max: 200,
      }),
      feature(FEATURES.ABSENCES, 'Absences (period)', NUMBER, { min: 0, max: 1000 }),
      feature(FEATURES.DELAYS, 'Delays (period)', NUMBER, { min: 0, max: 1000 }),
      feature(FEATURES.NEXT_LESSON, 'Next lesson', TEXT),
      feature(FEATURES.NEXT_DAY_START, 'Next school day start', TEXT),
      feature(FEATURES.LAST_GRADE, 'Last grade', TEXT),
    ],
  };
}

/**
 * The states of one student, in the `publishStates` format. A part PRONOTE
 * did not give (`null`) publishes nothing rather than a misleading zero.
 *
 * @param {Date} now
 * @param {{ homework_days: number }} config
 */
export function studentStates(gladys, account, student, now, config) {
  const ids = studentIds(gladys, account, student);
  const states = [];
  const number = (key, value) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      states.push({ device_feature_external_id: ids.feature(key), state: value });
    }
  };
  const text = (key, value) => {
    states.push({ device_feature_external_id: ids.feature(key), text: value || '—' });
  };

  if (student.grades) {
    number(FEATURES.AVERAGE, student.grades.average);
    text(FEATURES.LAST_GRADE, gradeLine(lastGrade(student)));
  }
  if (student.homework) {
    number(
      FEATURES.HOMEWORK_PENDING,
      homeworkShown(student, now, config.homework_days).filter((item) => !item.done).length,
    );
  }
  if (student.lessons) {
    const day = nextSchoolDay(student, now);
    if (student.homework) {
      number(
        FEATURES.HOMEWORK_NEXT_DAY,
        day ? homeworkOn(student, day).filter((item) => !item.done).length : 0,
      );
    }
    text(FEATURES.NEXT_LESSON, lessonLine(nextLesson(student, now), now));
    const first = day
      ? student.lessons.find((lesson) => !lesson.canceled && dayKey(lesson.start) === day)
      : null;
    text(FEATURES.NEXT_DAY_START, first ? timeOf(first.start) : '—');
  }
  if (student.absences) {
    number(FEATURES.ABSENCES, student.absences.length);
  }
  if (student.delays) {
    number(FEATURES.DELAYS, student.delays.length);
  }
  return states;
}
