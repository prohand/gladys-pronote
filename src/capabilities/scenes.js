// -----------------------------------------------------------------------------
// Scene triggers and scene actions (Gladys 5.1+).
//
// Triggers: what PRONOTE shows that was not there at the previous read — a new
// grade, new homework, a lesson canceled, a new absence or delay. They are fired
// by src/sync.js after each timed read (see src/pronote/events.js for what
// "new" means). Every event carries the student's device as `device`, which the
// `device` filter field of each trigger matches.
//
// Actions:
//   - `refresh` reads PRONOTE now. It never fires a trigger itself — a scene
//     "on new grade → refresh" would loop — the news it finds are fired by the
//     next timed read;
//   - `day_summary` answers from the last read, without calling PRONOTE: the
//     lessons and homework of a day, ready for a TTS announcement.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { DAYS, daySummary } from '../pronote/derive.js';
import { findStudent } from '../devices/index.js';
import { timeOf, truncate } from '../pronote/format.js';

const logger = createLogger({ name: 'scenes' });

/** Trigger key of each kind compared by src/pronote/events.js. Never rename. */
export const SCENE_TRIGGERS = {
  grades: 'new_grade',
  homework: 'new_homework',
  cancellations: 'lesson_canceled',
  absences: 'new_absence',
};

/** Scene action keys. Never rename. */
export const SCENE_ACTIONS = { REFRESH: 'refresh', DAY_SUMMARY: 'day_summary' };

/** One line per homework, for a TTS: `Mathématiques : exercice 3 p. 12`. */
export function homeworkText(homework) {
  return homework
    .map((item) => `${item.subject} : ${item.description.replace(/\n+/g, ' ')}`)
    .join('\n');
}

/**
 * Scene action handlers, keyed by action key.
 *
 * @param {import('../sync.js').PronoteSync} sync
 * @param {object} gladys
 */
export function sceneActionHandlers(sync, gladys) {
  return {
    async [SCENE_ACTIONS.REFRESH]() {
      logger.info('Scene action refresh');
      const result = await sync.sync({ fireEvents: false });
      return {
        success: result.ok,
        students: result.snapshot?.students.length ?? 0,
      };
    },

    async [SCENE_ACTIONS.DAY_SUMMARY](fields) {
      const snapshot = sync.snapshot;
      if (!snapshot) {
        throw new Error('PRONOTE has not been read yet');
      }
      const student = findStudent(gladys, snapshot, fields.device);
      if (!student) {
        throw new Error(`Unknown PRONOTE student device: ${fields.device}`);
      }
      const summary = daySummary(student, fields.day ?? DAYS.NEXT_SCHOOL_DAY, sync.now());
      const todo = summary.homework.filter((item) => !item.done);
      return {
        found: summary.held.length > 0,
        date: summary.date,
        student_name: student.name,
        lessons: summary.held.length,
        canceled: summary.canceled.length,
        first_lesson: summary.first ? timeOf(summary.first.start) : '',
        first_subject: summary.first?.subject ?? '',
        last_lesson_end: summary.last ? timeOf(summary.last.end) : '',
        canceled_subjects: summary.canceled.map((lesson) => lesson.subject).join(', '),
        homework: todo.length,
        homework_text: truncate(homeworkText(todo), 10000),
      };
    },
  };
}
