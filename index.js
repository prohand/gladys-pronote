// -----------------------------------------------------------------------------
// Entry point of the PRONOTE integration for Gladys.
//
// Role of this file: wire the SDK to the modules of src/. It holds no PRONOTE
// logic; it only:
//   1. instantiates the SDK (connection, auth, reconnection: handled by it);
//   2. registers the handlers BEFORE connect();
//   3. starts the read loop once connected, and restarts it on every
//      configuration change.
//
// Environment variables provided by the Gladys supervisor to the container:
//   - GLADYS_HOST_API_URL, GLADYS_INTEGRATION_TOKEN, GLADYS_INTEGRATION_SELECTOR
// The SDK reads them itself.
// -----------------------------------------------------------------------------

import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { normalizeConfig } from './src/config.js';
import { applyLogLevel, applyTimeZone } from './src/logging.js';
import { PronoteSession } from './src/pronote/session.js';
import { PronoteSync } from './src/sync.js';
import { actionHandlers } from './src/actions.js';
import { sceneActionHandlers } from './src/capabilities/scenes.js';
import { widgetHandlers } from './src/capabilities/widgets.js';

const gladys = new GladysIntegration();
const session = new PronoteSession();
const sync = new PronoteSync({ gladys, session });

/** Take a configuration: log level, time zone, then the session and the loop. */
function applyConfig(raw) {
  const config = normalizeConfig(raw);
  applyLogLevel(config);
  // Before any read: PRONOTE's times are turned into dates in this zone.
  applyTimeZone(config);
  session.setConfig(config);
  sync.setConfig(config);
  return config;
}

// --- Discovery: Gladys asks for the list of devices --------------------------
gladys.onScanRequest(async () => {
  if (!sync.snapshot) {
    await sync.sync();
  }
  await sync.publishDevices(true);
});

// --- Manifest actions: buttons in the Configuration screen -------------------
const actions = actionHandlers(sync, session);
gladys.onAction('test_connection', (fields) => actions.test_connection(fields));
gladys.onAction('login_qr_code', (fields) => actions.login_qr_code(fields));
gladys.onAction('forget_session', (fields) => actions.forget_session(fields));

// --- Scene actions (Gladys 5.1+) ---------------------------------------------
// Scene TRIGGERS need no handler: src/sync.js fires them after each read.
const sceneActions = sceneActionHandlers(sync, gladys);
gladys.onSceneAction('refresh', (fields) => sceneActions.refresh(fields));
gladys.onSceneAction('day_summary', (fields) => sceneActions.day_summary(fields));

// --- Dashboard widgets (Gladys 5.1+) -----------------------------------------
for (const [key, widget] of Object.entries(widgetHandlers(sync, gladys))) {
  gladys.onWidgetGet(key, (request) => widget.get(request));
  gladys.onWidgetAction(key, (actionKey) => widget.action(actionKey));
}

// --- Configuration updated by the user ---------------------------------------
gladys.onConfigUpdated(async (newConfig) => {
  logger.info('Configuration updated');
  applyConfig(newConfig);
  await sync.restart();
});

// --- Connection lifecycle ----------------------------------------------------
gladys.on('connected', async () => {
  try {
    applyConfig(await gladys.getConfig());
    await sync.restart();
  } catch (err) {
    logger.error('Post-connection initialization failed', err);
    await gladys
      .setConnectionStatus(false, {
        en: 'Initialization failed, check the integration logs.',
        fr: "L'initialisation a échoué, consultez les journaux de l'intégration.",
        de: 'Die Initialisierung ist fehlgeschlagen, sieh in den Protokollen der Integration nach.',
        es: 'La inicialización falló, consulte los registros de la integración.',
      })
      .catch(() => {});
  }
});

gladys.on('disconnected', () => {
  sync.stop();
});

// --- Graceful shutdown -------------------------------------------------------
gladys.handleShutdown((signal) => {
  logger.info(`Received ${signal} -> graceful shutdown`);
  sync.stop();
});

// --- Startup -----------------------------------------------------------------
logger.info('Starting the PRONOTE integration...');
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
