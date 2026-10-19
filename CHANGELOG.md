# Changelog

All notable changes to this integration are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[semantic versioning](https://semver.org/), bumped by the Release workflow.

## [Unreleased]

### Fixed

- A failed "Test the connection" or QR code login was shown in green under the button, like a success. It is now shown in red, still in the reader's language.

## [0.0.4] - 2026-10-19

### Fixed

- "Average unavailable, homework unavailable, lessons unavailable" while the integration still said it was connected, when PRONOTE had suspended the IP address: every tab failed on its own and the read went on, sending PRONOTE more requests. A suspended IP address (or a "slow down") now stops the read at once, shows the reason in the connection status and the widgets, and the next read waits one hour. Until then the widget Refresh button and the "read now" scene action answer without calling PRONOTE, so they do not extend the suspension.

## [0.0.3] - 2026-10-19

### Fixed

- Login refused with "PRONOTE refused the username or password" (and "PRONOTE refused the QR code") on PRONOTE 2026.2 servers, even with the right password: PRONOTE 2026.2 changed how the client answers the login challenge, and the bundled pawnote still answered the old way. The integration now patches pawnote at install time to answer the new way on 2026.2 servers; older servers keep the old answer.

## [0.0.2] - 2026-10-19

### Fixed

- Login failing with "The PRONOTE server cannot be reached or is busy" on PRONOTE 2026.2 servers: the instance page now starts its script with `Start (…);} catch`, which the bundled pawnote could not parse. The integration cleans that page before pawnote reads it, so password and QR-code logins work again.

## [0.0.1] - 2026-10-14

### Added

- PRONOTE integration for Gladys Assistant: one device per student (overall average, homework to do, homework for the next school day, absences, delays, next lesson, start of the next school day, last grade) and one device for the account (unread messages).
- Student and parent accounts: a parent account gets one device per child.
- Login with the PRONOTE username and password, or with a QR code for the accounts that go through an ENT. The session token PRONOTE hands out is kept in `/data` and replaces the password for the next logins.
- Scene triggers: a new grade, new homework, a lesson canceled, an absence or a delay.
- Scene actions: read PRONOTE now, and get the day of a student (lessons, first lesson, homework) for a notification or a voice announcement.
- Dashboard widgets: a student at a glance, and the timetable of a day.
- Configuration buttons: test the connection, log in with a QR code, forget the saved session.
- Texts in English, French, German and Spanish (configuration screen, messages, widgets, documentation).

[Unreleased]: https://github.com/prohand/gladys-pronote/compare/v0.0.4...HEAD
[0.0.4]: https://github.com/prohand/gladys-pronote/compare/v0.0.3...v0.0.4
[0.0.3]: https://github.com/prohand/gladys-pronote/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/prohand/gladys-pronote/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/prohand/gladys-pronote/releases/tag/v0.0.1
