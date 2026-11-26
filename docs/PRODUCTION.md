# PRODUCTION — Chandra Honda PSF (phase 1 demo · phase 2 production, CR-1)

> The production gate. The planner copied the **All projects** section plus the **Web app**
> section (this project is a web app). Each applicable item names the proof, tagged
> `(G-xx)`. At handover every applicable item must be **Built + tested**, **Waived by the
> owner**, or **N/A**; an **Owner step** must be done by the owner. Handover can't be approved while any
> item is open.

Status values: `Built + tested (<test or capture>)` · `Open (<what is missing>)` · `Owner step (<the step in the owner checklist>)` · `Waived by the owner (D-xx: <consequence>)` · `N/A (<reason>)`

Status at this review (2026-11-26): **Open** G-2 in the phase 2 table (no passing test names the admin-only reset), G-04 (one key not in `.env.example`), G-06 (no fresh-clone run), G-W7 (production HTTPS not checked). **Owner steps** G-03, G-5, G-W6 (restore rehearsal, checklist step 3), G-10, G-11, G-12 (checklist steps 4 to 6). Everything else is Built + tested.

Proofs cite test files under `tests/`. A proof counts only if the test passes in `.results/handover/check.log`; skipped (`test.fixme`) specs are not proof.

## All projects

| ID | Item | Proven by | Task | Status |
|---|---|---|---|---|
| G-01 | Errors reach the user in plain words; no stack traces or raw codes | a test that triggers each error path the spec names and checks the message | T-02, T-03, T-04, T-08, T-10 | Built + tested (auth.spec.ts:88 "a wrong password shows 'Email or password is incorrect'"; admin-users.spec.ts:284 "Account disabled, contact admin"; admin-responses.spec.ts:135 "AC-9 G-01 … wrong password saves nothing"; support-jobcards.spec.ts "test_s02_typed_number_not_found…" ("No job card JC-24-1042 at this branch yet"); S-13 "Couldn't save, try again" in support-jobcards.spec.ts:220, support-link-actions.spec.ts:164, admin-alerts.spec.ts:236, admin-responses.spec.ts:275, feedback-form.spec.ts:172; shell.spec.ts:97 "(G-W7) unknown URL shows a friendly not-found page without a stack trace") |
| G-02 | Saved data survives a restart of the app | a test that saves, restarts (or reopens the store) and reads it back | T-01 | Built + tested (tests/unit/server/admin/admin.test.ts:250-277 "test_s16_first_admin_from_nothing": a second CLI process reads the first one's user back from a disk database) |
| G-03 | The SPEC §13 data-safety choice is built (backup/export, undo), or "no backup" is stated in the README | Recently deleted + Restore test (T-08) and the README data-safety section | T-08, T-12 | Built + tested for restore (admin-responses.spec.ts:220 "US-21 S-09 G-03 delete then restore") + Owner step for the backup: Neon's 7-day history needs owner checklist steps 2 and 3 |
| G-04 | No secrets in the repo; every key the app reads is listed in `.env.example` | the `check.sh` secret scan + the reviewer's check of config reads | T-01, T-05 | Open: `PUBLIC_FLOOD_LIMIT_OVERRIDE` is read by `src/server/env.ts` but is not in `.env.example` (it is e2e-only and documented in the README). Secret scan: Built + tested (check.log:399-400 gitleaks "no leaks found"); `process.env` is read by `src/config/env.ts` and `src/server/env.ts` (reviewer's check) |
| G-05 | Every user input is validated (empty, too long, wrong type) | one test per input the spec names (job card, phone, form answers + 1,000-char texts, passwords, new-user form) | T-02, T-03, T-04, T-10 | Built + tested: job card and phone (tests/unit/domain/phase2/rules.test.ts: "landline phone → rejected" and "short job card number, long name, short reg. no → rejected"; the skipped support.spec "empty input is blocked" is not counted); form texts (feedback-form.spec.ts:121 and :155 "a long Tamil/emoji/<script> comment is capped at 1,000 (G-05)", tests/unit/feedback-form/clampText.test.ts, tests/unit/foundation/domain.test.ts); passwords and new-user form (admin-users.spec.ts:168 "empty name, invalid email and a 7-character password are rejected (G-05)", tests/unit/auth/password-rules.test.ts) |
| G-06 | A fresh clone installs and runs with the README's commands | the handover tester's fresh-clone run | T-12 | Open: no fresh-clone run exists. The tester ran the README commands in the handover worktree (not a fresh clone, cloning was blocked): 913 unit tests passed, `check.sh` PASSED, 198 e2e passed (34 skipped, not counted), log `.results/handover/check.log`. The README test command that failed (line 145) has been corrected since, and that corrected command has not been run |

## Web app

| ID | Item | Proven by | Task | Status |
|---|---|---|---|---|
| G-W1 | Passwords are hashed; sessions expire; logout ends the session | tests on login, expiry and logout | T-02 | Built + tested (argon2 on the server: tests/unit/server/auth/rehash.test.ts, tests/unit/server/auth/authRepo.test.ts; expiry: tests/unit/server/core/session.test.ts:96-107 (2 h support, 12 h admin idle), tests/unit/server/core/cookies.test.ts:26 (7 days); sign-out: tests/e2e/auth/auth.spec.ts:106 "Sign out ends the session") |
| G-W2 | A user can never see or change another user's data | a support user cannot see another branch's data; every repo refuses out-of-scope callers | T-03, T-06, T-07, T-08, T-09, T-10 | Built + tested (tests/unit/server/scope-matrix/scopeMatrix.test.ts; support-jobcards.spec.ts "test_us29_another_branch_cannot_see_the_card (S-29)"; support-links.spec.ts:94 "All branch links"; admin-audit.spec.ts:54; admin-overview.spec.ts:190; admin-customers.spec.ts:173; admin-users.spec.ts:130) |
| G-W3 | Forms are protected against CSRF and output is escaped (no XSS) | `<script>` text rendered as plain text in the form, recent comments and response detail | T-04, T-06, T-08 | Built + tested. XSS: feedback-form.spec.ts:121 and :155 (`<script>` shown as plain text, never run). CSRF: `src/server/rpc/handler.ts` requires a same-origin `Origin` header and a JSON body (tests/unit/server/rpc/handler.test.ts:97, :103) |
| G-W4 | Login and sign-up are rate-limited | sign-in attempts are capped per address and per account | — | Built + tested (the sign-in limits: tests/unit/server/auth-limits/authLimits.test.ts:57-101; tests/unit/server/auth-limits/parallelLimits.test.ts:63) |
| G-W5 | Usable on a 390px phone screen; inputs have labels | 360 px + 1440 px screenshots of each SPEC §7 screen + an accessibility check | T-11 | Built + tested (tests/e2e/walkthrough/screens.spec.ts:32, :80, :126 at 360 and 1440 px) |
| G-W6 | The database schema is created by migrations, and a backup can be restored | migrations run in tests and in the build; restore rehearsal on the paid plan | — | Built + tested for the migrations (tests/support/pglite.ts and tests/e2e/global-setup.ts apply the Drizzle migrations; tests/unit/server/db/client.test.ts:31; tests/unit/server/admin/admin.test.ts:263 runs `scripts/migrate.ts`) + Owner step for the restore rehearsal (owner checklist step 3) |
| G-W7 | Served over HTTPS where deployed, with an error page instead of a stack trace | the not-found page test + the HTTPS check on the production address | T-01, T-05 | Open: the not-found page is Built + tested (tests/e2e/foundation/shell.spec.ts:97). HTTPS on the production address is not checked: the live check cited earlier (`.results/handover/live/`) is not in the worktree and covered the phase 1 demo. Owner step: check the production address over HTTPS before go-live (part of G-10) |

## Phase 2 (CR-1): go-live gate rows

The rows below are the SPEC CR-1 gap items G-1 to G-15 (`docs/SPEC.md`, "Team decisions"). They are separate from the phase 1 G-0x rows above. Each row names the tests that prove it. Rows marked **Open** or **Owner step** block handover until the owner completes the step named. The owner steps are in the checklist below.

| ID | Item | Proven by | Task | Status |
|---|---|---|---|---|
| G-1 | Copy link only while it is on screen; Resend issues a fresh code for the same visit | link actions and reopening tests | T-03c, T-03d | Built + tested (tests/e2e/support-link-actions/support-link-actions.spec.ts:48, tests/e2e/support-links/support-links.spec.ts:53, tests/unit/server/visits-actions/linkActions.test.ts:104) |
| G-2 | Password reset by an admin only; no email reset link at launch | sign-in and reset tests | T-02b, T-10b | Open: no passing test covers the admin-only reset. The reviewer's proof, tests/e2e/auth/auth.spec.ts:88, is the sign-in message test. The Tester must name a passing test for the reset |
| G-3 | Emailed password-reset links | — | — | N/A (falls away with G-2: no email or SMS sending at launch, SPEC §8) |
| G-4 | Customer search, download and erase are main-admin only, across all branches | customer and erasure tests | T-24, T-25 | Built + tested (tests/e2e/admin-customers/admin-customers.spec.ts:173, tests/e2e/admin-customers-erase/admin-customers-erase.spec.ts:284, tests/unit/server/customers/customerRepo.test.ts:166, tests/unit/server/scope-matrix/scopeMatrix.test.ts:180) |
| G-5 | Erasures are logged so they can be re-applied after a restore; partial restore by default, full rollback only with the owner's go-ahead | re-apply tests; restore steps in DEPLOY.md sections 9 and 10 | T-25, T-28 | Built + tested (tests/unit/server/erasure/erasure.test.ts:308, tests/unit/server/admin-script/reapplyErasures.test.ts, tests/unit/server/erasure/reapplyCli.test.ts) + Owner step: the restore rehearsal (owner checklist step 3) |
| G-6 | Staff screens refresh only while in use (visible tab, used in the last 15 min) | polling tests | T-22 | Built + tested (tests/unit/remote/poller/poller.test.ts:42-92; tests/e2e/walkthrough/walkthrough.spec.ts:20). The preview capture is closed by D-44 |
| G-7 | Form limits per link (30 opens, 5 submits per hour) and a generous per-address flood limit | link and IP limit tests | T-04b | Built + tested (tests/e2e/feedback-form/feedback-form.spec.ts:256, tests/unit/server/feedback/feedbackRepo.test.ts:285, tests/unit/server/feedback/ipLimit.test.ts) |
| G-8 | Links belong to the branch; My links and All branch links | branch matrix tests | T-03c, T-03d, T-27 | Built + tested (tests/e2e/support-links/support-links.spec.ts:94, tests/e2e/support-link-actions/support-link-actions.spec.ts:75, tests/unit/server/visits/visitRepo.test.ts:232, :252) |
| G-9 | Main admin edits name, email, role and branch; branch admin edits name and email of support users | user update tests | T-10b | Built + tested (tests/e2e/admin-users/admin-users.spec.ts:205, tests/unit/server/users/updateUser.test.ts) |
| G-10 | Production at a new `vercel.app` address; demo taken offline at launch | owner steps | T-05b, T-28 | Owner step: production variables, first admin on the new project, and demo pause (owner checklist steps 4 to 6) |
| G-11 | Daily clean-up: retention, purge of deleted items, expired sessions and sign-in attempts | clean-up tests | T-26, T-28 | Built + tested for the code (tests/unit/server/cleanup/cleanup.test.ts:174-192, tests/unit/server/cleanup/purgeRedact.test.ts) + Owner step: the cron run on production (DEPLOY.md section 5) |
| G-12 | Company name and privacy contact replaced; notice says 3 years and that hosting providers may store data outside India | notice tests and the owner's real details | T-04b, T-36 | Built + tested for the code (tests/e2e/feedback-form/feedback-form.spec.ts:85, tests/unit/foundation/contact-env.test.ts) + Owner step: real company name, phone and email (checklist step 4); legal check (step 5) |
| G-13 | Session limits (support 2 h idle, admins 12 h idle, 7 days at most), sign-out, sign-in lockout | session and lockout tests | T-02b, T-20 | Built + tested (tests/unit/server/core/session.test.ts:96-107, tests/unit/server/auth-limits/authLimits.test.ts:57, tests/e2e/account/account.spec.ts:28, tests/e2e/auth/auth.spec.ts:106) |
| G-14 | Setup only on an empty system; one-time password valid 72 h; maintainer recovery only when no main admin can sign in | init, reissue and recover tests | T-19, T-02b | Built + tested (tests/unit/server/admin/admin.test.ts:77, :173, :250; tests/e2e/auth/auth.spec.ts:51, which passes on mobile-360 and is skipped on desktop by design, auth.spec.ts:79) |
| G-15 | A retry of a save that reached the server counts as success | duplicate and retry tests | T-03b, T-04b | Built + tested (tests/e2e/support-jobcards/support-jobcards.spec.ts:188 "test_s29_lost_reply_then_retry…", tests/e2e/feedback-form/feedback-form.spec.ts:172, tests/unit/server/jobCards/jobCardRepo.test.ts:121, :131) |

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
