// The whole integration against the SDK's fake Gladys and the fake pawnote:
// the same session, sync and handlers index.js wires, with a clock the test
// moves.

import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { normalizeConfig } from '../../src/config.js';
import { PronoteSession } from '../../src/pronote/session.js';
import { PronoteSync } from '../../src/sync.js';
import { actionHandlers } from '../../src/actions.js';
import { sceneActionHandlers } from '../../src/capabilities/scenes.js';
import { widgetHandlers } from '../../src/capabilities/widgets.js';
import { PASSWORD_CONFIG, createFakePawnote } from './fakePawnote.js';
import { NOW, lea, tom } from './fixtures.js';

export async function createIntegration({
  students = [lea(), tom()],
  config = { ...PASSWORD_CONFIG, account_kind: 'parent' },
  account = { name: 'DURAND Marie', unread: 2 },
} = {}) {
  const gladys = createFakeGladys({ config });
  const api = createFakePawnote({ students, account });
  const session = new PronoteSession({ api });
  const clock = { now: NOW };
  const sync = new PronoteSync({ gladys, session, now: () => clock.now });
  const normalized = normalizeConfig(config);
  session.setConfig(normalized);
  sync.setConfig(normalized);

  const actions = actionHandlers(sync, session);
  for (const [key, handler] of Object.entries(actions)) {
    gladys.onAction(key, handler);
  }
  for (const [key, handler] of Object.entries(sceneActionHandlers(sync, gladys))) {
    gladys.onSceneAction(key, handler);
  }
  for (const [key, widget] of Object.entries(widgetHandlers(sync, gladys))) {
    gladys.onWidgetGet(key, (request) => widget.get(request));
    gladys.onWidgetAction(key, (actionKey) => widget.action(actionKey));
  }
  await gladys.connect();
  return { gladys, api, session, sync, clock };
}
