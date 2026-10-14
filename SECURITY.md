# Security policy

## Supported versions

Only the latest release of the PRONOTE integration receives security fixes.
Update the integration from the Gladys store before reporting an issue.

| Version        | Supported |
| -------------- | --------- |
| latest release | Yes       |
| older          | No        |

## Reporting a vulnerability

Please do **not** open a public issue for a security problem.

Report it privately through GitHub: open the **Security** tab of
[prohand/gladys-pronote](https://github.com/prohand/gladys-pronote/security), then
**Report a vulnerability**.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- any log line that helps (remove passwords, session tokens, names and addresses
  first — PRONOTE data is about minors).

You should get a first answer within 7 days. A fix is released as a new version of
the integration, and the advisory is published once users can update.

## Scope

In scope: the code of this repository and the Docker image it publishes.

Out of scope: Gladys Assistant itself (report to
[GladysAssistant/Gladys](https://github.com/GladysAssistant/Gladys/security)),
PRONOTE and its servers (report to Index Éducation), and the
[pawnote](https://github.com/LiterateInk/Pawnote.js) library this integration uses
to speak the PRONOTE protocol (report to its maintainers; we update as soon as a
fix is published).

## What the integration keeps, and where

- **The PRONOTE password** stays in the integration's secret configuration field,
  managed by Gladys. It is only sent to the PRONOTE server you configured, and is
  never logged.
- **The PRONOTE session token** (given by PRONOTE after a login, it replaces the
  password for the next ones) and a random device id are kept in
  `/data/session.json`, readable by the container user only (mode `0600`). The
  "Forget the saved session" button deletes the token.
- **What was already announced** to the scenes is kept in `/data/seen.json` as
  hashes, not as the grades or homework themselves.
- Grades, homework and timetable are kept in memory only, and published to your
  Gladys as device states.

## Known advisories in dependencies

`pawnote` depends on `node-forge`, which has an open advisory on **RSA signature
verification** (GHSA-86w9-cpqp-85rv, no fixed version yet). pawnote only uses
`node-forge` to **encrypt** the PRONOTE requests (RSA, AES) and never verifies a
signature with it, so the advisory does not apply to this integration. We follow it
and update as soon as a fixed version exists.

## Good practices for users

- Prefer a dedicated PRONOTE account when your school offers one (a parent
  account rather than the student's own).
- Keep Gladys and the integration up to date.
- Use "Forget the saved session" when you stop using the integration, and remove
  the integration from Gladys to delete its `/data` volume.
