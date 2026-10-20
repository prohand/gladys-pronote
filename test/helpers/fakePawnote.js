// -----------------------------------------------------------------------------
// A stand-in for the pawnote module: the same functions, answering from plain
// data the test controls, and recording every call. No network, no crypto.
//
// `data.students` lists the students as PRONOTE would give them; each one
// carries the answers of its tabs (grades, homework, lessons, notebook). A test
// changes `data` between two reads to make something new appear, and sets
// `failures.<function>` to an error name to make that function throw it.
// -----------------------------------------------------------------------------

/** An Error whose `name` is one of pawnote's error classes. */
export function pawnoteError(name, message = name) {
  const error = new Error(message);
  error.name = name;
  return error;
}

/** A local date: `at(2026, 10, 15, 8)` is 15 October 2026 at 08:00. */
export function at(year, month, day, hour = 0, minute = 0) {
  return new Date(year, month - 1, day, hour, minute);
}

/** A period covering the whole school year 2026-2027 and its first term. */
export function schoolPeriods() {
  const year = {
    id: 'Y',
    name: 'Année continue',
    kind: 0,
    startDate: at(2026, 9, 1),
    endDate: at(2027, 7, 5),
  };
  const term = {
    id: 'T1',
    name: 'Trimestre 1',
    kind: 1,
    startDate: at(2026, 9, 1),
    endDate: at(2026, 11, 30),
  };
  return { year, term };
}

/** A student resource with its grades and notebook tabs. */
export function studentResource(id, name, extra = {}) {
  const { year, term } = schoolPeriods();
  const tab = { defaultPeriod: term, periods: [year, term] };
  return {
    id,
    kind: 4,
    name,
    className: '3E B',
    establishmentName: 'Collège Jean Moulin',
    tabs: new Map([
      [198, tab],
      [19, tab],
    ]),
    ...extra,
  };
}

const subject = (name) => ({ id: name, name, inGroups: false });
const value = (points, kind = 0) => ({ kind, points });

/** A grade as pawnote decodes it. */
export function grade(subjectName, points, date, extra = {}) {
  return {
    id: `${subjectName}-${date.getTime()}`,
    subject: subject(subjectName),
    value: typeof points === 'number' ? value(points) : value(0, points.kind),
    outOf: value(extra.outOf ?? 20),
    date,
    coefficient: extra.coefficient ?? 1,
    comment: extra.comment ?? '',
    average: extra.average === undefined ? undefined : value(extra.average),
    isBonus: false,
    isOptional: false,
    isOutOf20: false,
  };
}

/** A homework as pawnote decodes it. */
export function homework(subjectName, description, deadline, done = false) {
  return {
    id: `${subjectName}-${deadline.getTime()}`,
    subject: subject(subjectName),
    description,
    deadline,
    done,
    backgroundColor: '#fff',
    attachments: [],
    difficulty: 0,
    themes: [],
    return: { kind: 0, canUpload: false },
  };
}

/** A lesson as pawnote decodes it. */
export function lesson(subjectName, start, end, extra = {}) {
  return {
    is: 'lesson',
    id: `${subjectName}-${start.getTime()}`,
    subject: subject(subjectName),
    startDate: start,
    endDate: end,
    canceled: false,
    exempted: false,
    test: false,
    classrooms: ['B12'],
    teacherNames: ['M. DUPONT'],
    personalNames: [],
    groupNames: [],
    virtualClassrooms: [],
    kind: 0,
    blockLength: 2,
    blockPosition: 0,
    weekNumber: 7,
    ...extra,
  };
}

/**
 * The fake module.
 *
 * @param {object} data
 * @param {object[]} data.students student resources, each with
 *   `grades` ({ overallAverage, grades }), `homework`, `lessons`, `notebook`
 * @param {object} [data.account] `{ name, unread }`
 */
export function createFakePawnote(data) {
  const calls = [];
  const failures = {};
  let tokenCount = 0;

  const fail = (name) => {
    const failure = failures[name];
    if (typeof failure === 'function') {
      const error = failure();
      if (error) {
        throw error;
      }
    } else if (failure) {
      throw pawnoteError(failure);
    }
  };

  const logIn = (handle, { url, kind, username }) => {
    handle.information = { url, accountKind: kind };
    handle.user = {
      id: 'U',
      name: data.account?.name ?? 'DURAND Marie',
      kind,
      authorizations: { canReadDiscussions: data.account?.unread !== undefined },
      resources: data.students,
    };
    handle.userResource = data.students[0];
    tokenCount += 1;
    return {
      url,
      kind,
      username: username.toLowerCase(),
      token: `token-${tokenCount}`,
      navigatorIdentifier: 'navigator',
    };
  };

  const api = {
    calls,
    failures,
    data,
    createSessionHandle: () => ({}),
    async loginCredentials(handle, auth) {
      calls.push(['loginCredentials', { ...auth }]);
      fail('loginCredentials');
      return logIn(handle, auth);
    },
    async loginToken(handle, auth) {
      calls.push(['loginToken', { ...auth }]);
      fail('loginToken');
      return logIn(handle, auth);
    },
    async loginQrCode(handle, info) {
      calls.push(['loginQrCode', { ...info }]);
      fail('loginQrCode');
      const url = info.qr.url.replace(/\/[^/]*$/, '');
      return logIn(handle, { url, kind: 6, username: info.qr.login });
    },
    use(handle, resource) {
      handle.userResource = resource;
    },
    async gradesOverview(handle, period) {
      calls.push(['gradesOverview', handle.userResource.name, period.id]);
      fail('gradesOverview');
      return handle.userResource.grades ?? { grades: [], subjectsAverages: [] };
    },
    async assignmentsFromIntervals(handle, start, end) {
      calls.push(['assignmentsFromIntervals', handle.userResource.name, start, end]);
      fail('assignmentsFromIntervals');
      // Like pawnote: only what is due in the interval.
      return (handle.userResource.homework ?? []).filter(
        (item) => start <= item.deadline && item.deadline <= end,
      );
    },
    async timetableFromIntervals(handle, start, end) {
      calls.push(['timetableFromIntervals', handle.userResource.name, start, end]);
      fail('timetableFromIntervals');
      // Like PRONOTE: the lessons of the days asked, the last one included.
      const until = new Date(end);
      until.setDate(until.getDate() + 1);
      const classes = (handle.userResource.lessons ?? []).filter(
        (entry) => start <= entry.startDate && entry.startDate < until,
      );
      return { classes, withCanceledClasses: true };
    },
    parseTimetable(_handle, timetable) {
      // The real one hides a canceled lesson whose slot another one took.
      timetable.classes = timetable.classes.filter((entry) => !entry.superseded);
    },
    async notebook(handle, period) {
      calls.push(['notebook', handle.userResource.name, period.id]);
      fail('notebook');
      return (
        handle.userResource.notebook ?? {
          absences: [],
          delays: [],
          punishments: [],
          observations: [],
          precautionaryMeasures: [],
        }
      );
    },
    async discussions() {
      calls.push(['discussions']);
      fail('discussions');
      return { folders: [], items: [{ numberOfMessagesUnread: data.account?.unread ?? 0 }] };
    },
  };
  return api;
}

/** A configuration that logs in with a password. */
export const PASSWORD_CONFIG = {
  url: 'https://0123456a.index-education.net/pronote/eleve.html',
  account_kind: 'student',
  username: 'MDurand',
  password: 'secret',
};
