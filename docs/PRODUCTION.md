# PRODUCTION — Chandra Honda PSF (phase 1 demo · phase 2 production, CR-1)

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
| G-01 | Errors reach the user in plain words; no stack traces or raw codes | a test that triggers each error path the spec names and checks the message | T-02, T-03, T-04, T-08, T-10 | Built + tested (e2e: auth.spec "a wrong password shows 'Email or password is incorrect'", "a deactivated user sees 'Account disabled, contact admin' (G-01)"; support.spec "unknown number shows the message; empty input is blocked (G-01, G-05)", "a clipboard failure shows Couldn't copy"; feedback-form.spec "s14 unknown and cancelled links say Link not valid (S-14, G-01)", plus the expired and already-submitted page tests; admin-responses.spec "AC-9 G-01 edit ... wrong password saves nothing"; S-13 "Couldn't save, try again" in the support, feedback-form, admin-alerts, admin-responses and admin-users specs; shell.spec "(G-W7) unknown URL shows a friendly not-found page without a stack trace") |
| G-02 | Saved data survives a restart of the app | a test that saves, restarts (or reopens the store) and reads it back | T-01 | Built + tested (shell.spec "AC-1 / session and data survive a reload (G-02)"; feedback-form.spec s04 "reloads on step 4 and submits") |
| G-03 | The SPEC §13 data-safety choice is built (backup/export, undo), or "no backup" is stated in the README | Recently deleted + Restore test (T-08) and the README "no backup" line (T-12) | T-08, T-12 | Built + tested (admin-responses.spec "US-21 G-03 delete (confirm + password) then restore (password) keeps answers and alert status"; walkthrough.spec "S-09 delete a response ... Restore brings all back"; README "Data safety" section states "No backup.") |
| G-04 | No secrets in the repo; every key the app reads is listed in `.env.example` | the `check.sh` secret scan + the reviewer's check of config reads | T-01, T-05 | Built + tested (check.sh gitleaks "no leaks"; reviewer's config-read check: src/config/env.ts is the only process.env reader in src, and all its keys are in .env.example; the demo password is public by design) |
| G-05 | Every user input is validated (empty, too long, wrong type) | one test per input the spec names (job card, phone, form answers + 1,000-char texts, passwords, new-user form) | T-02, T-03, T-04, T-10 | Built + tested (job card: support.spec "empty input is blocked (G-05)", support-repos.test "an empty or blank input is a VALIDATION error (G-05)"; phone: support-repos.test "toWhatsAppNumber accepts 10-digit and +91 mobiles; rejects landline, short, blank", support.spec "s03 landline: Send disabled"; form texts: feedback-form.spec "s13 long Tamil/emoji/<script> comment is capped at 1,000 (G-05)", domain.test "text over 1000 characters is invalid", clampText.test; passwords and new-user form: admin-users.spec "empty name, invalid email and a 7-character password are rejected (G-05)", auth.spec "a user who must set a password ... (G-05, S-15)") |
| G-06 | A fresh clone installs and runs with the README's commands | the handover tester's fresh-clone run | T-12 | Built + tested (fresh-clone run: 11 of 11 README commands OK, covering install, dev, build, start, test, test:e2e and check.sh in both modes) |

## Web app

| ID | Item | Proven by | Task | Status |
|---|---|---|---|---|
| G-W1 | Passwords are hashed; sessions expire; logout ends the session | tests on login, expiry and logout | T-02 | Waived by the owner (D-18: demo on sample data — sessions don't expire and password hashing runs in the browser; must be built server-side before real customer data). Built + tested for the hashing and sign-out parts (auth.test "Sign out ends the session"; auth.spec "Sign out ends the session (G-W1)") |
| G-W2 | A user can never see or change another user's data | Support 2 can't see Support 1's links (T-03); every admin repo returns `FORBIDDEN` to a support session (T-06–T-10); server 403s are Phase 2 | T-03, T-06, T-07, T-08, T-09, T-10 | Built + tested (support.spec "Support 2 never sees Support 1's links (G-W2)", "another user's link shows a note and no actions (isMine)"; repo FORBIDDEN unit tests in alertsRepo, auditRepo, analyticsRepo, responsesRepo, usersRepo and support-repos; D-15 redirects in walkthrough.spec "AC-6 D-15 ... redirected to /not-allowed from every /admin URL, no data" and the admin-overview, admin-responses, admin-users and admin-audit "G-W2 / D-15" tests; server 403s are Phase 2) |
| G-W3 | Forms are protected against CSRF and output is escaped (no XSS) | `<script>` text rendered as plain text in the form, recent comments and response detail | T-04, T-06, T-08 | Built + tested for XSS (admin-overview.spec "G-W3 / a <script> comment is shown as plain text", admin-responses.spec "G-W3 ... <script> shows as plain text", feedback-form.spec "a <script> comment is shown as plain text, never run"). N/A for CSRF (no server requests or cookies in phase 1, all writes are in the browser; CSRF via Auth.js in Phase 2) |
| G-W4 | Login and sign-up are rate-limited | — | — | N/A (phase 1 sign-in is simulated in the browser with fictional data and no server to protect; rate limits are Phase 2, SPEC §0, §9) |
| G-W5 | Usable on a 390px phone screen; inputs have labels | 360 px + 1440 px screenshots of each SPEC §7 screen + an accessibility check | T-11 | Built + tested (walkthrough screens.spec "T-11 SPEC 7 screens at 360 and 1440 px (G-W5)", a label check on every visible control at both sizes; feedback-form.spec "steps fit 360 px with big targets (AC-3, AC-11)") |
| G-W6 | The database schema is created by migrations, and a backup can be restored | — | — | N/A (no database in phase 1, data lives in browser storage; owner chose no backup, SPEC §13; Neon + Drizzle migrations are Phase 2) |
| G-W7 | Served over HTTPS where deployed, with an error page instead of a stack trace | the deploy check on the Vercel preview (T-05) + the not-found page test (T-01) | T-01, T-05 | Built + tested (live checks 2026-11-22: HTTPS 200 + HSTS, http→https 308, robots Disallow, noindex, 404 page without stack trace — evidence .results/handover/live/; not-found page: tests/e2e/foundation/shell.spec.ts) |

## Phase 2 (CR-1): go-live gate rows

The rows below are the SPEC CR-1 gap items G-1 to G-15 (`docs/SPEC.md`, "Team decisions"). They are separate from the phase 1 G-0x rows above. Each row names the tasks whose acceptance criteria prove it. Rows marked **Open** block handover until the owner completes the step named. The owner steps are in the checklist below.

| ID | Item | Proven by | Task | Status |
|---|---|---|---|---|
| G-1 | Copy link only while it is on screen; Resend issues a fresh code for the same visit | T-03c "Copy link" and "Leaving and reopening" criteria; T-03d Resend criterion (G-1, S-17) | T-03c, T-03d | Built + tested (T-03c, T-03d) |
| G-2 | Password reset by an admin only; no email reset link at launch | T-02b sign-in hint criterion; T-10b reset criterion (US-27) | T-02b, T-10b | Built + tested (T-02b, T-10b) |
| G-3 | Emailed password-reset links | — | — | N/A (falls away with G-2: no email or SMS sending at launch, SPEC §8) |
| G-4 | Customer search, download and erase are main-admin only, across all branches | T-24 "Not allowed / FORBIDDEN (G-4, G-W2)" criterion; T-25 erase criteria (S-21) | T-24, T-25 | Built + tested (T-24, T-25) |
| G-5 | Erasures are logged so they can be re-applied after a restore; partial restore by default, full rollback only with the owner's go-ahead | T-25 `reapply-erasures` criterion (S-24); restore steps in DEPLOY.md sections 9 and 10 | T-25, T-28 | Built + tested (T-25 unit and e2e; restore steps in DEPLOY.md). The restore rehearsal is owner checklist step 3 |
| G-6 | Staff screens refresh only while in use (visible tab, used in the last 15 min) | T-22 polling criteria (S-23, G-6) | T-22 | Built + tested (T-22). The live capture on the preview (T-23) is closed by D-44 |
| G-7 | Form limits per link (30 opens, 5 submits per hour) and a generous per-address flood limit | T-04b "6th submit on one link" criterion (S-22, G-7) | T-04b | Built + tested (T-04b) |
| G-8 | Links belong to the branch; My links and All branch links | T-03c "All branch links" criterion; T-27 branch matrix (218 of 218) | T-03c, T-03d, T-27 | Built + tested (T-03c, T-27) |
| G-9 | Main admin edits name, email, role and branch; branch admin edits name and email of support users | T-10b criterion 2 (S-20, G-9) | T-10b | Built + tested (T-10b) |
| G-10 | Production at a new `vercel.app` address; demo taken offline at launch | T-28 criteria 1 and 2 (owner steps); demo takedown is owner checklist step 6 | T-05b, T-28 | Open (owner: production variables and first admin on the new project; demo takedown) |
| G-11 | Daily clean-up: retention, purge of deleted items, expired sessions and sign-in attempts | T-26 criteria (G-11) | T-26, T-28 | Open (owner: the cron run on production, DEPLOY.md section 5). Code is Built + tested (T-26) |
| G-12 | Company name and privacy contact replaced; notice says 3 years and that hosting providers may store data outside India | T-04b notice criterion (G-12); T-36 keys from env | T-04b, T-36 | Open (owner: real company name, phone and email are checklist step 4; legal check is step 5). Notice code is Built + tested (T-04b, T-36) |
| G-13 | Session limits (support 2 h idle, admins 12 h idle, 7 days at most), sign-out, sign-in lockout | T-02b sign-out criterion; T-20 lockout criterion (S-27, G-13) | T-02b, T-20 | Built + tested (T-02b, T-20) |
| G-14 | Setup only on an empty system; one-time password valid 72 h; maintainer recovery only when no main admin can sign in | T-19 init, reissue and recover criteria (S-16, G-14) | T-19, T-02b | Built + tested (T-19, T-02b) |
| G-15 | A retry of a save that reached the server counts as success | T-03b duplicate and retry criterion (S-29, G-15); T-04b same-phone retry criterion (S-29, G-15) | T-03b, T-04b | Built + tested (T-03b, T-04b) |

## Owner checklist: go-live gate (SPEC §12.1)

No real customer link is sent until every step below is done and the go-live check passes. Work through them in order. Keep every password and connection address in your password manager. Never paste them into chat, email or a file.

1. **Vercel Pro.** Sign in to your Vercel account, open Billing and upgrade the account to **Pro**. The Hobby plan is for non-commercial use only. Done when Billing shows Pro.
2. **Neon paid plan and 7-day history.** In the Neon console, open Billing and upgrade the project to a **paid** plan. Then open the project settings and set **history retention** (restore window) to **7 days**. Done when Neon shows 7 days.
3. **Restore rehearsal on the paid plan.** After steps 1 and 2, do one partial restore as DEPLOY.md section 9 describes, using a time a few minutes ago, into a new branch. Look at one row, then delete that restore branch, because it holds personal data. Do not do section 10. Write the date in your notes. If a step is unclear, ask the developer first.
4. **Company details (including the dealer phone).** Get from the dealership: the registered company name, the head-office phone number for customers, and the head-office privacy email. In Vercel, open the project's Settings > Environment Variables and replace the placeholder values for **Production**: `NEXT_PUBLIC_COMPANY_NAME`, `NEXT_PUBLIC_PRIVACY_PHONE`, `NEXT_PUBLIC_PRIVACY_EMAIL` and `NEXT_PUBLIC_DEALER_PHONE`. Then redeploy Production from the Vercel dashboard, because these values are built into the app.
5. **Legal check of the notice.** Give the welcome notice and the `/privacy` page text to someone who knows the DPDP Act (India's data protection law). Ask them to confirm: answers are kept for 3 years, hosting providers may store them outside India, and the contact details are right. Keep their written reply. If the wording changes, the developer updates it and you check it again.
6. **Demo offline.** Do this at launch, once the first admin can sign in on the new address. In the Vercel dashboard open project `chandra-psf` > Settings > Advanced, then **pause** it. Pausing can be undone; deleting the project cannot. The demo's code stays in git (tag `demo-v1`).

Also required by SPEC §12.1: the first main admin is created on production and has set their own password (DEPLOY.md section 6).

7. **Go-live check (the developer runs it, D-45).** Until this check passes, production holds no customer data. The pre-demo check and all test data (test job cards, test links, test answers) happen on the **preview** only, which uses the Neon development database, never on production. When steps 1 to 6 are done, tell the developer; you do not run the check yourself. The developer, in a new PowerShell window in the project folder, sets these for that window only, with the same values as Vercel Production: `DATABASE_URL` (the production pooled address), `APP_URL` (the `https://` address), and the four `NEXT_PUBLIC_` values from step 4. Then runs:
```powershell
pnpm golive:check
```
- Expect `golive:check PASSED`.
- A `FAIL` line names one setting or one table, with a count only. A setting is fixed in Vercel (by you, if it is one of your step 4 values), Production is redeployed, and the developer runs the check again.
- A table count means the production database holds rows the gate does not allow before launch, for example test data made on production by mistake. The developer decides how to clear it; nobody deletes rows by hand without that decision.
- The developer closes the PowerShell window when done, so the production address is not left set.

Only when the check passes, and steps 1 to 6 are done, may the first real customer link be sent.
