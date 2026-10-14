# Gladys PRONOTE

External integration for [Gladys Assistant](https://gladysassistant.com) that
brings **PRONOTE** — the school life software of most French schools — into your
smart home: grades, homework, timetable, absences and unread messages of a
student, or of every child of a parent account.

Built with the JavaScript SDK
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js),
from the official
[integration template](https://github.com/GladysAssistant/integration-template-js).
PRONOTE has no public API: the integration speaks the protocol of its web client
through [pawnote](https://github.com/LiterateInk/Pawnote.js).

> Not affiliated with Index Éducation or PRONOTE.

User documentation: [English](docs/en.md) · [Français](docs/fr.md) ·
[Deutsch](docs/de.md) · [Español](docs/es.md).

## What it does

| Surface                | Content                                                                                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Device per student     | Overall average, homework to do, homework for the next school day, absences, delays, next lesson, next day start, last grade |
| Device for the account | Unread messages                                                                                                              |
| Scene triggers         | `new_grade`, `new_homework`, `lesson_canceled`, `new_absence`                                                                |
| Scene actions          | `refresh` (read now), `day_summary` (lessons and homework of a day, ready for a TTS)                                         |
| Dashboard widgets      | `student` (a student at a glance), `timetable` (the lessons of a day)                                                        |
| Configuration buttons  | Test the connection, log in with a QR code (ENT accounts), forget the saved session                                          |
| Languages              | English, French, German, Spanish                                                                                             |
| Transport              | `cloud` (the PRONOTE server is on the internet)                                                                              |

Requires **Gladys ≥ 5.1.0** (scene and widget declarations).

## How it works

- **Login**: the saved session token first (PRONOTE gives one at every login,
  bound to a device id generated once — the way the mobile app stays logged in),
  the username and password when there is none, or a QR code for the accounts
  that log in through an ENT. The token is saved in `/data/session.json`.
- **Reading**: on the integration's own timer (15 minutes by default), one pass
  over every student: grades of the current period, homework of the next three
  weeks, timetable of the next eight days, absences and delays, unread messages.
- **Publishing**: devices when the list of students changes, states through
  `publishChangedStates`, scene events for what is new (remembered by content in
  `/data/seen.json`, so a restart announces nothing again), the `cloud` /
  `unreachable` badge, the connection status and a widget refresh nudge.
- **Failures**: a refused password, a disabled account or a security setup asked
  by PRONOTE **pause** the loop instead of retrying (PRONOTE suspends the IP after
  failed logins) until the configuration is saved or a button is pressed.

## Project structure

```
.
├─ index.js                          # SDK bootstrap + wiring
├─ src/
│  ├─ config.js                      # defaults + normalization
│  ├─ logging.js                     # log level + school time zone
│  ├─ storage.js                     # JSON files in /data
│  ├─ i18n.js                        # en, fr, de, es
│  ├─ sync.js                        # the read loop and its publications
│  ├─ actions.js                     # Configuration screen buttons
│  ├─ pronote/                       # session, read, derive, events, errors, format
│  ├─ devices/                       # account + student devices, stable ids
│  └─ capabilities/                  # scenes.js, widgets.js (Gladys 5.1+)
├─ docs/                             # user documentation (en, fr, de, es)
├─ test/                             # node --test, fake pawnote + the SDK's fake Gladys
├─ gladys-assistant-integration.json # manifest
├─ Dockerfile                        # Node 24 Alpine, read-only rootfs ready
├─ CHANGELOG.md                      # Keep a Changelog, rolled by the Release workflow
├─ CLAUDE.md                         # project rules for coding assistants & contributors
├─ SECURITY.md                       # how to report a vulnerability privately
└─ .github/                          # CI, release, build, GitHub releases, Dependabot
```

## Development

```bash
npm install
npm test               # node --test, no network
npm run lint           # ESLint
npm run format:check   # Prettier
npx github:GladysAssistant/integration-store .   # store admission checks
```

Run it against a Gladys in developer mode:

```bash
GLADYS_HOST_API_URL="http://localhost:1443" \
GLADYS_INTEGRATION_TOKEN="<token>" \
GLADYS_INTEGRATION_SELECTOR="pronote" \
PRONOTE_DATA_DIR=./data \
LOG_LEVEL=debug \
npm start
```

The CI runs format, lint and tests on Node 22 and 24 on every push and pull
request; pull requests also run the store checks and build the image.

## Releasing

1. Describe the changes under `## [Unreleased]` in [`CHANGELOG.md`](CHANGELOG.md).
2. **Actions → Release → Run workflow**, pick `patch`, `minor` or `major` (the
   first release: `major`, from `0.0.0` to `1.0.0`).
3. The workflow bumps `package.json`, the manifest `version` and `docker_image`,
   moves the changelog section, tags `vX.Y.Z`, builds the `linux/amd64` +
   `linux/arm64` image to `ghcr.io/prohand/gladys-pronote`, and publishes the
   GitHub Release.

To appear in the Gladys store, the repository must be public and carry the GitHub
topic `gladys-assistant-integration`, and the image package on ghcr.io must be
public.

## License

[GPL-3.0-or-later](LICENSE), because the integration bundles
[pawnote](https://github.com/LiterateInk/Pawnote.js) (GPL-3.0-or-later).
