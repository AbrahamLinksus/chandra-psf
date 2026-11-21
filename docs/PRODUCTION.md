# PRODUCTION — Chandra Honda PSF (phase 1 demo)

> The production gate. The planner copied the **All projects** section plus the **Web app**
> section (this project is a web app; phase 1 has no server, database or real auth, see
> SPEC §0). Each applicable item names the task whose acceptance criterion proves it, tagged
> `(G-xx)`. At handover every applicable item must be **Built + tested** or **Waived by the
> owner** (consequence stated, logged in DECISIONS.md). Handover can't be approved while any
> item is open.

Status values: `Open` · `Built + tested (<test or capture>)` · `Waived by the owner (D-xx: <consequence>)` · `N/A (<reason>)`

## All projects

| ID | Item | Proven by | Task | Status |
|---|---|---|---|---|
| G-01 | Errors reach the user in plain words; no stack traces or raw codes | a test that triggers each error path the spec names and checks the message | T-02, T-03, T-04, T-08, T-10 | Open |
| G-02 | Saved data survives a restart of the app | a test that saves, restarts (or reopens the store) and reads it back | T-01 | Open |
| G-03 | The SPEC §13 data-safety choice is built (backup/export, undo), or "no backup" is stated in the README | Recently deleted + Restore test (T-08) and the README "no backup" line (T-12) | T-08, T-12 | Open |
| G-04 | No secrets in the repo; every key the app reads is listed in `.env.example` | the `check.sh` secret scan + the reviewer's check of config reads | T-01, T-05 | Open |
| G-05 | Every user input is validated (empty, too long, wrong type) | one test per input the spec names (job card, phone, form answers + 1,000-char texts, passwords, new-user form) | T-02, T-03, T-04, T-10 | Open |
| G-06 | A fresh clone installs and runs with the README's commands | the handover tester's fresh-clone run | T-12 | Open |

## Web app

| ID | Item | Proven by | Task | Status |
|---|---|---|---|---|
| G-W1 | Passwords are hashed; sessions expire; logout ends the session | tests on login, expiry and logout | T-02 | Open (phase 1 covers demo hashing + sign-out in every tab; session expiry and argon2id are Phase 2 per SPEC §0, so that part needs an owner waiver at handover) |
| G-W2 | A user can never see or change another user's data | Support 2 can't see Support 1's links (T-03); every admin repo returns `FORBIDDEN` to a support session (T-06–T-10); server 403s are Phase 2 | T-03, T-06, T-07, T-08, T-09, T-10 | Open |
| G-W3 | Forms are protected against CSRF and output is escaped (no XSS) | `<script>` text rendered as plain text in the form, recent comments and response detail | T-04, T-06, T-08 | Open (XSS part only; CSRF N/A in phase 1: no server requests or cookies, all writes are in-browser; CSRF via Auth.js in Phase 2) |
| G-W4 | Login and sign-up are rate-limited | — | — | N/A (phase 1 sign-in is simulated in the browser with fictional data and no server to protect; rate limits are Phase 2, SPEC §0, §9) |
| G-W5 | Usable on a 390px phone screen; inputs have labels | 360 px + 1440 px screenshots of each SPEC §7 screen + an accessibility check | T-11 | Open |
| G-W6 | The database schema is created by migrations, and a backup can be restored | — | — | N/A (no database in phase 1, data lives in browser storage; owner chose no backup, SPEC §13; Neon + Drizzle migrations are Phase 2) |
| G-W7 | Served over HTTPS where deployed, with an error page instead of a stack trace | the deploy check on the Vercel preview (T-05) + the not-found page test (T-01) | T-01, T-05 | Open |
