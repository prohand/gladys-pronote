// -----------------------------------------------------------------------------
// The buttons of the Configuration screen (manifest `actions`).
//
//   - `test_connection` reads PRONOTE now and says what it found, or why not;
//   - `login_qr_code` logs in with the QR code PRONOTE shows, for the accounts
//     that go through an ENT and have no PRONOTE password;
//   - `forget_session` forgets the saved session (to change account, or after a
//     password change on another device).
//
// A successful test or QR login also restarts the read loop, which a refused
// password had paused (see src/sync.js). A failure is thrown as an
// `ActionError`, so Gladys shows it in red, not in green like a success.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { localize, pick } from './i18n.js';
import { describeError } from './pronote/errors.js';
import { formatPoints } from './pronote/format.js';

const logger = createLogger({ name: 'actions' });

/**
 * A failed action, shown in red under the button in the reader's language.
 *
 * The SDK acks a thrown error as `{ success: false, error: err.message }` and
 * the core hands that value to the screen untouched, which renders a
 * multi-language object like a success message. `message` is set after
 * `super()` so it stays the object: `Error` would turn it into a string.
 */
export class ActionError extends Error {
  /** @param {Record<string, string>} message one text per language, `en` included */
  constructor(message) {
    super(message.en);
    this.name = 'ActionError';
    this.message = message;
  }
}

/** Action keys, as declared in the manifest. Never rename. */
export const ACTION_KEYS = {
  TEST_CONNECTION: 'test_connection',
  LOGIN_QR_CODE: 'login_qr_code',
  FORGET_SESSION: 'forget_session',
};

const WORDS = {
  connected: {
    en: 'Connected to PRONOTE',
    fr: 'Connecté à PRONOTE',
    de: 'Mit PRONOTE verbunden',
    es: 'Conectado a PRONOTE',
  },
  as: { en: 'as', fr: 'en tant que', de: 'als', es: 'como' },
  noStudent: {
    en: 'no student on this account',
    fr: 'aucun élève sur ce compte',
    de: 'kein Schüler in diesem Konto',
    es: 'ningún alumno en esta cuenta',
  },
  average: { en: 'average', fr: 'moyenne', de: 'Durchschnitt', es: 'media' },
  homework: { en: 'homework', fr: 'devoirs', de: 'Hausaufgaben', es: 'deberes' },
  lessons: { en: 'lessons', fr: 'cours', de: 'Stunden', es: 'clases' },
  unavailable: {
    en: 'not available',
    fr: 'indisponible',
    de: 'nicht verfügbar',
    es: 'no disponible',
  },
  unread: {
    en: 'unread messages',
    fr: 'messages non lus',
    de: 'ungelesene Nachrichten',
    es: 'mensajes no leídos',
  },
};

/** What a successful read found, in every language. */
export function describeSnapshot(snapshot) {
  return localize((language) => {
    const word = (key) => pick(language, WORDS[key]);
    const students = snapshot.students.map((student) => {
      const average =
        typeof student.grades?.average === 'number'
          ? formatPoints(student.grades.average)
          : word('unavailable');
      const homework = student.homework ? student.homework.length : word('unavailable');
      const lessons = student.lessons ? student.lessons.length : word('unavailable');
      const school = [student.class_name, student.establishment].filter(Boolean).join(', ');
      return `${student.name}${school ? ` (${school})` : ''}: ${word('average')} ${average}, ${word('homework')} ${homework}, ${word('lessons')} ${lessons}`;
    });
    const unread =
      typeof snapshot.account.unread_messages === 'number'
        ? ` ${snapshot.account.unread_messages} ${word('unread')}.`
        : '';
    return `${word('connected')} ${word('as')} ${snapshot.account.name}. ${students.join('. ') || word('noStudent')}.${unread}`;
  });
}

const QR_DONE = {
  en: 'Logged in with the QR code. The session is saved: the password field can stay empty.',
  fr: 'Connecté avec le QR code. La session est enregistrée : le champ mot de passe peut rester vide.',
  de: 'Mit dem QR-Code angemeldet. Die Sitzung ist gespeichert: Das Passwortfeld kann leer bleiben.',
  es: 'Sesión iniciada con el código QR. La sesión queda guardada: el campo de contraseña puede quedar vacío.',
};

const QR_INVALID = {
  en: 'This is not the content of a PRONOTE QR code. Scan the code with your phone camera and paste the text it shows, which starts with {"jeton".',
  fr: 'Ce n’est pas le contenu d’un QR code PRONOTE. Scannez le code avec l’appareil photo du téléphone et collez le texte affiché, qui commence par {"jeton".',
  de: 'Das ist nicht der Inhalt eines PRONOTE-QR-Codes. Scanne den Code mit der Handykamera und füge den angezeigten Text ein, der mit {"jeton" beginnt.',
  es: 'Esto no es el contenido de un código QR de PRONOTE. Escanee el código con la cámara del teléfono y pegue el texto que muestra, que empieza por {"jeton".',
};

const QR_REFUSED = {
  en: 'PRONOTE refused the QR code: check the 4-digit code, and generate a new QR code (it is valid for a few minutes only).',
  fr: 'PRONOTE a refusé le QR code : vérifiez le code à 4 chiffres, et générez un nouveau QR code (il n’est valable que quelques minutes).',
  de: 'PRONOTE hat den QR-Code abgelehnt: Prüfe den 4-stelligen Code und erzeuge einen neuen QR-Code (er ist nur wenige Minuten gültig).',
  es: 'PRONOTE rechazó el código QR: compruebe el código de 4 cifras y genere un nuevo código QR (solo es válido unos minutos).',
};

const FORGOTTEN = {
  en: 'Saved session forgotten. The next read logs in with the password, or wait for a new QR code login.',
  fr: 'Session enregistrée oubliée. La prochaine lecture se connectera avec le mot de passe, ou attendez une nouvelle connexion par QR code.',
  de: 'Gespeicherte Sitzung vergessen. Der nächste Abruf meldet sich mit dem Passwort an, oder warte auf eine neue Anmeldung per QR-Code.',
  es: 'Sesión guardada olvidada. La próxima lectura iniciará sesión con la contraseña, o espere un nuevo inicio de sesión con código QR.',
};

/**
 * The action handlers, keyed by action key.
 *
 * @param {import('./sync.js').PronoteSync} sync
 * @param {import('./pronote/session.js').PronoteSession} session
 */
export function actionHandlers(sync, session) {
  return {
    async [ACTION_KEYS.TEST_CONNECTION]() {
      logger.info('Action test_connection');
      const result = await sync.restart();
      if (!result.ok) {
        throw new ActionError(result.error.message);
      }
      return describeSnapshot(result.snapshot);
    },

    async [ACTION_KEYS.LOGIN_QR_CODE](fields) {
      logger.info('Action login_qr_code');
      try {
        await session.loginWithQrCode({ qr: fields.qr_content, pin: fields.pin });
      } catch (err) {
        if (err.name === 'InvalidQrCodeError') {
          throw new ActionError(QR_INVALID);
        }
        const error = describeError(err);
        logger.warn(`QR code login failed (${error.code}): ${err.name}: ${err.message}`);
        throw new ActionError(error.code === 'bad_credentials' ? QR_REFUSED : error.message);
      }
      const result = await sync.restart();
      if (!result.ok) {
        throw new ActionError(result.error.message);
      }
      return QR_DONE;
    },

    async [ACTION_KEYS.FORGET_SESSION]() {
      logger.info('Action forget_session');
      await session.forget();
      return FORGOTTEN;
    },
  };
}
