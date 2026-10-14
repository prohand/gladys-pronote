// -----------------------------------------------------------------------------
// One school week, as PRONOTE would give it, seen on Wednesday 14 October 2026
// at 10:00 (local time): a student with grades, homework, lessons — one of them
// canceled — an absence and a delay.
// -----------------------------------------------------------------------------

import { at, grade, homework, lesson, studentResource } from './fakePawnote.js';

export const NOW = at(2026, 10, 14, 10);

export function lea() {
  return studentResource('S1', 'DURAND Léa', {
    grades: {
      overallAverage: { kind: 0, points: 14.5 },
      classAverage: { kind: 0, points: 12.25 },
      subjectsAverages: [],
      grades: [
        grade('MATHEMATIQUES', 15, at(2026, 10, 12), { average: 11.5, coefficient: 2 }),
        grade('FRANCAIS', { kind: 1 }, at(2026, 10, 13)),
        grade('ANGLAIS', 8, at(2026, 10, 5), { outOf: 10 }),
      ],
    },
    homework: [
      homework('MATHEMATIQUES', '<p>Exercice 3 p.&nbsp;12</p>', at(2026, 10, 15)),
      homework('FRANCAIS', 'Lire le chapitre 2', at(2026, 10, 15), true),
      homework('HISTOIRE', 'Réviser <b>la Révolution</b>', at(2026, 10, 20)),
    ],
    lessons: [
      lesson('MATHEMATIQUES', at(2026, 10, 14, 8), at(2026, 10, 14, 9)),
      lesson('ANGLAIS', at(2026, 10, 14, 14), at(2026, 10, 14, 15)),
      lesson('MATHEMATIQUES', at(2026, 10, 15, 9), at(2026, 10, 15, 10)),
      lesson('PHYSIQUE', at(2026, 10, 15, 10), at(2026, 10, 15, 11), {
        canceled: true,
        status: 'Prof. absent',
      }),
      lesson('HISTOIRE', at(2026, 10, 15, 11), at(2026, 10, 15, 12), { test: true }),
    ],
    notebook: {
      absences: [
        {
          id: 'A1',
          startDate: at(2026, 10, 5, 8),
          endDate: at(2026, 10, 5, 12),
          justified: true,
          reason: 'Médical',
        },
      ],
      delays: [{ id: 'D1', date: at(2026, 10, 6, 8), minutes: 10, justified: false }],
      punishments: [],
      observations: [],
      precautionaryMeasures: [],
    },
  });
}

export function tom() {
  return studentResource('S2', 'DURAND Tom', {
    className: '6E A',
    grades: { grades: [], subjectsAverages: [] },
    homework: [],
    lessons: [lesson('SPORT', at(2026, 10, 16, 8), at(2026, 10, 16, 10))],
  });
}
