# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

A Gladys Assistant **external integration** (Node 22+, ESM, no build step) for
**PRONOTE**, the French school life software by Index Éducation: grades,
homework, timetable, absences and unread messages of a student or of every child
of a parent account. It runs in its own sandboxed Docker container and talks to
Gladys through
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js),
and to PRONOTE through [`pawnote`](https://github.com/LiterateInk/Pawnote.js)
(PRONOTE has no public API; pawnote speaks the protocol of its web client).
Started from the official JavaScript template; workflows shared with
`prohand/gladys-devmel`.

Gladys 5.1+: scene triggers (new grade, new homework, lesson canceled, new
absence), scene actions (read now, day summary) and two widgets (student,
timetable).

## Commands

```bash
npm install
npm test                                    # node --test (built-in runner)
node --test test/sync.test.js               # one file
node --test --test-name-pattern "QR"        # tests whose name matches
npm run lint                                # eslint .
npm run format:check                        # prettier --check . (CI gate)
npm run format                              # prettier --write .
npx github:GladysAssistant/integration-store .   # store admission checks
```

The CI (`.github/workflows/ci.yml`) runs `format:check`, `lint` and `test` on
Node 22 and 24; pull requests also run the store checks and build the Docker
image. Run the three commands before pushing.

## Architecture

```
index.js                     SDK wiring only: handlers registered before connect()
src/config.js                DEFAULT_CONFIG (mirrors the manifest defaults) + normalization
src/logging.js               log level + process time zone, from the configuration
src/storage.js               JSON files in /data (session token, what was announced)
src/i18n.js                  LANGUAGES (en, fr, de, es), pick, localize
src/pronote/session.js       login: saved token → password → QR code; relogin on expiry
src/pronote/read.js          one read of PRONOTE → plain snapshot (no pawnote object leaks)
src/pronote/derive.js        what the snapshot means "now": next lesson, next school day…
src/pronote/events.js        what is new since the last read (content keys) + event data
src/pronote/errors.js        pawnote errors → code, retry or not, message in 4 languages
src/pronote/format.js        dates (local), HTML → text, content keys
src/pronote/fetcher.js       HTTP client handed to pawnote (fixes the 2026.2 instance page)
src/devices/                 account device + one student device each, ids, states
src/sync.js                  the read loop: read, publish devices/states/events/badge
src/actions.js               Configuration screen buttons
src/capabilities/scenes.js   scene trigger keys + scene action handlers
src/capabilities/widgets.js  dashboard widgets
gladys-assistant-integration.json  manifest
docs/{en,fr,de,es}.md        user documentation, re-hosted by Gladys
scripts/patch-pawnote.js     postinstall: teaches pawnote PRONOTE 2026.2 (login challenge, parent child)
test/                        node --test, fake pawnote + the SDK's fake Gladys
```

### Invariants worth knowing

- **External ids are forever.** Devices are keyed on the PRONOTE server address +
  the student's name (`src/devices/ids.js`), never on PRONOTE's internal `N` ids,
  which are not guaranteed to survive a new session. Feature keys, action,
  trigger, widget and config keys are stored by users: never rename them.
- **"Already seen" is by content** (`contentKey`), for the same reason, and the
  first read of a student only remembers (no flood of triggers at install).
- **The session token rotates**: PRONOTE gives a new one at every login, bound to
  the device id we generate once. Always save it again (`PronoteSession.save`).
- **Never retry a refused password on a timer**: PRONOTE suspends the IP after
  failed logins. A non-retryable error pauses the loop (`src/sync.js`) until the
  configuration changes or a button is pressed.
- **Times are local to the school**: pawnote builds Dates from PRONOTE's
  zone-less times in the process time zone; `applyTimeZone` sets `TZ` from the
  configuration before any read. Tests build dates with `at()` (local), so they
  pass in any `TZ`.
- **Scene actions never fire triggers** (no loops): `refresh` reads with
  `fireEvents: false`, the next timed read announces the news.
- **A part that fails is `null`**, never an empty list: nothing is published for
  it and its trigger is not compared.
- **The container rootfs is read-only.** Write only under `/data`. Never log
  passwords, tokens or the QR code content.
- **pawnote is patched at install** (`postinstall` → `scripts/patch-pawnote.js`):
  PRONOTE 2026.2 changed the login challenge, and refuses a parent account's pages
  when the request does not name the child (`Signature.membre`); pawnote 1.6.2
  does neither. `npm install --ignore-scripts` leaves pawnote unpatched;
  `test/challenge.test.js` and `test/member.test.js` then fail. The Dockerfile
  copies `scripts/` before `npm ci` for that reason.
- **Parent accounts**: `api.use(handle, child)` before each child's reads; the
  patch sends that child with every request.
- **A session that expires during the read that opened it was closed by PRONOTE**
  (`SessionClosedError`): it is not opened again at once, and the loop waits an
  hour. Only the session of an earlier read is logged in again and retried.

### Manifest

`test/manifest.test.js` ties the manifest to the code: config defaults, action /
scene / widget handlers, the keys each scene event sends vs the declared
`fields` + `variables`, the day options, the 4 languages and the store length
limits. Change both sides together. Fields the older cores do not know need a
higher `gladys_version` (scene/widget declarations: 5.1.0).

## Rules

- **Versions belong to the Release workflow** (Actions → Release). Never edit
  `version` in `package.json` or in the manifest, nor the `docker_image` tag, by
  hand.
- **Changelog.** Every user-visible change adds a line under `## [Unreleased]` in
  `CHANGELOG.md` (`### Added`, `Changed`, `Fixed`, `Removed`, `Security`). Never
  write a version heading: the Release workflow moves the section.
- **User-facing text is in four languages** (`{ en, fr, de, es }`): manifest texts,
  action messages, connection status, widgets, and `docs/en.md`, `docs/fr.md`,
  `docs/de.md`, `docs/es.md`, kept in sync.
- **License.** The project is GPL-3.0-or-later because it bundles pawnote
  (GPL-3.0-or-later).
- **Style.** Prettier formats, ESLint catches mistakes. Comments explain why, in
  English. Tests never touch the network: `test/helpers/fakePawnote.js` stands in
  for pawnote, `createFakeGladys()` for Gladys.
