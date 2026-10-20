// -----------------------------------------------------------------------------
// What a PRONOTE failure means for the user.
//
// pawnote throws one error class per case (BadCredentialsError,
// SessionExpiredError…). They are recognized by `name`, not `instanceof`, so a
// test can throw a plain Error with the same name, and so a second copy of the
// library in node_modules cannot break the match.
//
// Each case says whether trying again later can help (`retry`) and what the user
// reads, in every language, in the Configuration screen and under the actions.
// -----------------------------------------------------------------------------

/** The codes this integration reports, also used as scene/test outputs. */
export const ERROR_CODES = {
  NOT_CONFIGURED: 'not_configured',
  BAD_CREDENTIALS: 'bad_credentials',
  SECURITY: 'security',
  ACCOUNT_DISABLED: 'account_disabled',
  SUSPENDED_IP: 'suspended_ip',
  RATE_LIMITED: 'rate_limited',
  UNAVAILABLE: 'unavailable',
  SESSION_EXPIRED: 'session_expired',
  SESSION_CLOSED: 'session_closed',
  ACCESS_DENIED: 'access_denied',
  UNKNOWN: 'unknown',
};

const MESSAGES = {
  [ERROR_CODES.NOT_CONFIGURED]: {
    en: 'Not connected: fill in the PRONOTE address, username and password, or log in with a QR code.',
    fr: 'Non connecté : renseignez l’adresse PRONOTE, l’identifiant et le mot de passe, ou connectez-vous avec un QR code.',
    de: 'Nicht verbunden: Gib die PRONOTE-Adresse, den Benutzernamen und das Passwort ein oder melde dich mit einem QR-Code an.',
    es: 'Sin conexión: indique la dirección de PRONOTE, el usuario y la contraseña, o inicie sesión con un código QR.',
  },
  [ERROR_CODES.BAD_CREDENTIALS]: {
    en: 'PRONOTE refused the username or password (or the saved session). Check them, or log in again with a QR code.',
    fr: 'PRONOTE a refusé l’identifiant ou le mot de passe (ou la session enregistrée). Vérifiez-les, ou reconnectez-vous avec un QR code.',
    de: 'PRONOTE hat den Benutzernamen oder das Passwort (oder die gespeicherte Sitzung) abgelehnt. Prüfe sie oder melde dich erneut mit einem QR-Code an.',
    es: 'PRONOTE rechazó el usuario o la contraseña (o la sesión guardada). Compruébelos o vuelva a iniciar sesión con un código QR.',
  },
  [ERROR_CODES.SECURITY]: {
    en: 'PRONOTE asks to set up the account security (new password, PIN or second factor). Log in once in the PRONOTE app to finish it, then use "Log in with a QR code".',
    fr: 'PRONOTE demande de configurer la sécurité du compte (nouveau mot de passe, code PIN ou double authentification). Connectez-vous une fois dans l’application PRONOTE pour la terminer, puis utilisez « Se connecter avec un QR code ».',
    de: 'PRONOTE verlangt die Einrichtung der Kontosicherheit (neues Passwort, PIN oder zweiter Faktor). Melde dich einmal in der PRONOTE-App an, um sie abzuschließen, und nutze dann „Mit QR-Code anmelden“.',
    es: 'PRONOTE pide configurar la seguridad de la cuenta (nueva contraseña, PIN o doble autenticación). Inicie sesión una vez en la app PRONOTE para terminarla y luego use «Iniciar sesión con un código QR».',
  },
  [ERROR_CODES.ACCOUNT_DISABLED]: {
    en: 'This PRONOTE account is disabled: contact the school.',
    fr: 'Ce compte PRONOTE est désactivé : contactez l’établissement.',
    de: 'Dieses PRONOTE-Konto ist deaktiviert: Wende dich an die Schule.',
    es: 'Esta cuenta de PRONOTE está desactivada: contacte con el centro.',
  },
  [ERROR_CODES.SUSPENDED_IP]: {
    en: 'PRONOTE temporarily suspended the IP address of your Gladys (too many failed logins or requests). The next read waits one hour; avoid refreshing until then.',
    fr: 'PRONOTE a provisoirement suspendu l’adresse IP de votre Gladys (trop d’échecs de connexion ou de requêtes). La prochaine lecture attend une heure ; évitez d’actualiser d’ici là.',
    de: 'PRONOTE hat die IP-Adresse deines Gladys vorübergehend gesperrt (zu viele fehlgeschlagene Anmeldungen oder Anfragen). Der nächste Abruf wartet eine Stunde; aktualisiere bis dahin nicht.',
    es: 'PRONOTE suspendió temporalmente la dirección IP de su Gladys (demasiados intentos fallidos o solicitudes). La próxima lectura espera una hora; evite actualizar hasta entonces.',
  },
  [ERROR_CODES.RATE_LIMITED]: {
    en: 'PRONOTE asks to slow down: the next read will wait. Raise the refresh interval if it happens often.',
    fr: 'PRONOTE demande de ralentir : la prochaine lecture attendra. Augmentez l’intervalle de rafraîchissement si cela arrive souvent.',
    de: 'PRONOTE bittet um weniger Anfragen: Der nächste Abruf wartet. Erhöhe das Aktualisierungsintervall, wenn das oft passiert.',
    es: 'PRONOTE pide ir más despacio: la próxima lectura esperará. Aumente el intervalo de actualización si ocurre a menudo.',
  },
  [ERROR_CODES.UNAVAILABLE]: {
    en: 'The PRONOTE server cannot be reached or is busy. Check the address; it will be tried again.',
    fr: 'Le serveur PRONOTE est injoignable ou occupé. Vérifiez l’adresse ; un nouvel essai sera fait.',
    de: 'Der PRONOTE-Server ist nicht erreichbar oder ausgelastet. Prüfe die Adresse; es wird erneut versucht.',
    es: 'El servidor de PRONOTE no responde o está ocupado. Compruebe la dirección; se volverá a intentar.',
  },
  [ERROR_CODES.SESSION_EXPIRED]: {
    en: 'The PRONOTE session expired; it is opened again at the next read.',
    fr: 'La session PRONOTE a expiré ; elle est rouverte à la prochaine lecture.',
    de: 'Die PRONOTE-Sitzung ist abgelaufen; sie wird beim nächsten Abruf neu geöffnet.',
    es: 'La sesión de PRONOTE caducó; se vuelve a abrir en la próxima lectura.',
  },
  [ERROR_CODES.SESSION_CLOSED]: {
    en: 'PRONOTE ended the session right after the login, often after refusing a page to this account. The next read waits one hour; avoid refreshing until then.',
    fr: 'PRONOTE a fermé la session juste après la connexion, souvent après avoir refusé une page à ce compte. La prochaine lecture attend une heure ; évitez d’actualiser d’ici là.',
    de: 'PRONOTE hat die Sitzung direkt nach der Anmeldung beendet, oft nachdem eine Seite für dieses Konto verweigert wurde. Der nächste Abruf wartet eine Stunde; aktualisiere bis dahin nicht.',
    es: 'PRONOTE cerró la sesión justo después de iniciarla, a menudo tras denegar una página a esta cuenta. La próxima lectura espera una hora; evite actualizar hasta entonces.',
  },
  [ERROR_CODES.ACCESS_DENIED]: {
    en: 'PRONOTE denied access to this page for this account.',
    fr: 'PRONOTE a refusé l’accès à cette page pour ce compte.',
    de: 'PRONOTE hat den Zugriff auf diese Seite für dieses Konto verweigert.',
    es: 'PRONOTE denegó el acceso a esta página para esta cuenta.',
  },
  [ERROR_CODES.UNKNOWN]: {
    en: 'PRONOTE answered with an unexpected error, see the integration logs.',
    fr: 'PRONOTE a répondu par une erreur inattendue, voir les journaux de l’intégration.',
    de: 'PRONOTE hat mit einem unerwarteten Fehler geantwortet, siehe die Protokolle der Integration.',
    es: 'PRONOTE respondió con un error inesperado, consulte los registros de la integración.',
  },
};

/** pawnote error name → our code, and whether a later attempt can succeed. */
const BY_NAME = {
  BadCredentialsError: [ERROR_CODES.BAD_CREDENTIALS, false],
  AuthenticateError: [ERROR_CODES.BAD_CREDENTIALS, false],
  SecurityError: [ERROR_CODES.SECURITY, false],
  AccountDisabledError: [ERROR_CODES.ACCOUNT_DISABLED, false],
  SuspendedIPError: [ERROR_CODES.SUSPENDED_IP, true],
  RateLimitedError: [ERROR_CODES.RATE_LIMITED, true],
  BusyPageError: [ERROR_CODES.UNAVAILABLE, true],
  PageUnavailableError: [ERROR_CODES.UNAVAILABLE, true],
  SessionExpiredError: [ERROR_CODES.SESSION_EXPIRED, true],
  SessionClosedError: [ERROR_CODES.SESSION_CLOSED, true],
  AccessDeniedError: [ERROR_CODES.ACCESS_DENIED, false],
  NotConfiguredError: [ERROR_CODES.NOT_CONFIGURED, false],
};

/** Node network errors: the server is down or the address is wrong. */
const NETWORK_CODES = ['ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN'];

/** Thrown when there is nothing to log in with. */
export class NotConfiguredError extends Error {
  constructor() {
    super('No PRONOTE credentials nor saved session');
    this.name = 'NotConfiguredError';
  }
}

/**
 * Thrown when the session ends during the read that opened it: not a timeout,
 * PRONOTE closed it, and logging in again at once would fail the same way.
 */
export class SessionClosedError extends Error {
  /** @param {Error} cause the SessionExpiredError pawnote threw */
  constructor(cause) {
    super('PRONOTE ended the session right after the login', { cause });
    this.name = 'SessionClosedError';
  }
}

/**
 * Classify an error thrown while talking to PRONOTE.
 *
 * @param {unknown} err
 * @returns {{ code: string, retry: boolean, message: Record<string, string> }}
 */
export function describeError(err) {
  let [code, retry] = BY_NAME[err?.name] ?? [ERROR_CODES.UNKNOWN, true];
  const cause = err?.cause?.code ?? err?.code;
  const fetchFailed = err?.name === 'TypeError' && err?.message === 'fetch failed';
  if (code === ERROR_CODES.UNKNOWN && (NETWORK_CODES.includes(cause) || fetchFailed)) {
    // fetch() throws a TypeError("fetch failed") whose cause carries the code.
    code = ERROR_CODES.UNAVAILABLE;
  }
  return { code, retry, message: MESSAGES[code] };
}

/**
 * Whether the error means the session is gone and a fresh login may fix it.
 *
 * @param {unknown} err
 */
export function isSessionLost(err) {
  return err?.name === 'SessionExpiredError';
}

/** Errors about the whole connection, not about one tab. */
const WHOLE_READ_ERRORS = ['SessionExpiredError', 'SuspendedIPError', 'RateLimitedError'];

/**
 * Whether the error stops the whole read rather than one part of it. A
 * suspended IP address fails every request that follows: reading the other
 * tabs anyway only sends PRONOTE more requests and reports a read that
 * "worked" with nothing in it.
 *
 * @param {unknown} err
 */
export function stopsTheRead(err) {
  return WHOLE_READ_ERRORS.includes(err?.name);
}
