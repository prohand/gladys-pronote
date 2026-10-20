# Changelog

All notable changes to this integration are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[semantic versioning](https://semver.org/), bumped by the Release workflow.

## [Unreleased]

## [0.0.8] - 2026-10-20

### Added

- Three widgets with one list each: **PRONOTE homework** (with a "To do" tile), **PRONOTE grades** (with the average) and **PRONOTE correspondence book**. A dashboard can spread the information over small cards instead of adding the student widget several times.

### Changed

- The student widget is now a summary: its **List** setting has a new **None** choice, the default. Choose a list there to get the 0.0.7 widget back.
- The student widget no longer shows "Next school day" when the next lesson already is the start of that day (it said the same thing twice).
- The default refresh interval is 30 minutes instead of 15: grades and homework do not change faster, and PRONOTE gets fewer requests. An interval already set is kept.

## [0.0.7] - 2026-10-20

### Added

- The student widget has a **List** setting: the homework (default), the last 8 grades with the class average, or the correspondence book. Add the widget several times to see several lists.
- The homework list shows every homework of the window, each marked **Done** or **Not done** (or **Today** / **Tomorrow**), as PRONOTE does. The "Homework" tile still counts what is not done.
- The notes of the correspondence book ("carnet de correspondance": observations, encouragements, book issues) are read with the absences, with no extra request to PRONOTE, and shown in the student widget.
- Scene trigger "A note is written in the correspondence book", with the kind, title, subject, comment and date, and a filter on the kind.

### Fixed

- During the holidays, the widgets showed "0 homework" and "No school day in the coming week" while PRONOTE showed the homework and lessons of the return. The timetable is now read three weeks ahead, and the homework horizon counts its days from the next school day (from the return during the holidays).

## [0.0.6] - 2026-10-20

### Fixed

- Parent accounts on PRONOTE 2026.2: "AccessDeniedError" on the grades, then "The PRONOTE session expired" at every read, until PRONOTE suspended the IP address. The bundled pawnote did not name the selected child in its requests, as PRONOTE's own website does; PRONOTE refused the page and closed the session. The integration now patches pawnote at install time to send the child with every request of a parent account. This also gives each child of a multi-child parent account their own grades, homework and absences.
- A session PRONOTE closes during the read that opened it is no longer opened again at once: each read logged in twice, and the logins added up to an IP suspension. The status now says that PRONOTE closed the session, and the next read waits one hour, like after a suspension.

## [0.0.5] - 2026-10-19

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

[Unreleased]: https://github.com/prohand/gladys-pronote/compare/v0.0.8...HEAD
[0.0.8]: https://github.com/prohand/gladys-pronote/compare/v0.0.7...v0.0.8
[0.0.7]: https://github.com/prohand/gladys-pronote/compare/v0.0.6...v0.0.7
[0.0.6]: https://github.com/prohand/gladys-pronote/compare/v0.0.5...v0.0.6
[0.0.5]: https://github.com/prohand/gladys-pronote/compare/v0.0.4...v0.0.5
[0.0.4]: https://github.com/prohand/gladys-pronote/compare/v0.0.3...v0.0.4
[0.0.3]: https://github.com/prohand/gladys-pronote/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/prohand/gladys-pronote/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/prohand/gladys-pronote/releases/tag/v0.0.1
