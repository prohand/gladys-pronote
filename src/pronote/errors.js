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
    en: 'PRONOTE suspended the IP address of your Gladys after too many failed logins. Wait before trying again.',
    fr: 'PRONOTE a suspendu l’adresse IP de votre Gladys après trop d’échecs de connexion. Patientez avant de réessayer.',
    de: 'PRONOTE hat die IP-Adresse deines Gladys nach zu vielen fehlgeschlagenen Anmeldungen gesperrt. Warte, bevor du es erneut versuchst.',
    es: 'PRONOTE suspendió la dirección IP de su Gladys tras demasiados intentos fallidos. Espere antes de volver a intentarlo.',
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
