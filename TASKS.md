# TASKS — Chandra Honda PSF (phase 1 demo)

Status: Backlog → In progress → Review → Needs you → Done

A task is one user-visible feature slice end to end (data, logic, UI, tests), never one layer.
Only the first task may be a foundation task (the app starts and shows its first screen; shared
helpers). Caps by size: small 8, medium 15, large 30; an extra task carries `Why separate:`.

Every task needs `Owner:`, `Depends on:` (real data or interface dependencies only, never a
preferred order; `—` for none) and `Files:` (paths or globs it will create or change): the build
schedules from them (`taskgraph.py`), running tasks with no dependency and no shared files at
the same time.

`Files:` is the task's **claim**: while it runs, no other task's agent may write those paths (the
scope guard enforces it). `Frozen:` lists the shared code the foundation builds; after it, only a
task that claims a frozen path itself may change it. Work that touches every feature is one
wire-up task at the end, not an edit inside each feature.

Size: medium (cap 15) · 12 tasks · production gate: `docs/PRODUCTION.md`

Frozen: package.json, pnpm-lock.yaml, next.config.ts, src/app/layout.tsx, src/app/providers.tsx, src/app/globals.css, src/app/admin/layout.tsx, src/app/support/layout.tsx, src/components/ui/**, src/components/shared/**, src/hooks/**, src/data/access/**, src/data/local/store.ts, src/data/local/bus.ts, src/data/local/fault.ts, src/data/local/crypto.ts, src/data/local/seed.ts, src/data/local/createLocalDataAccess.ts, src/data/local/db.ts, src/data/local/ids.ts, src/data/local/repoDeps.ts, src/data/local/results.ts, src/data/local/session.ts, src/data/local/repos/token.ts, src/data/local/repos/auditWriter.ts, src/domain/types.ts, src/domain/schemas.ts, src/domain/questionnaire.ts, src/domain/answers.ts, src/domain/time.ts, src/domain/visitStatus.ts, src/domain/constants.ts, src/domain/visibility.ts, src/domain/alertRules.ts, src/config/env.ts, tests/support/**, gate configs (tsconfig.json; eslint.config.mjs; prettier config; .dependency-cruiser.cjs; vitest.config.ts; playwright.config.ts; postcss.config.mjs; components.json; scripts/check.sh; .env.example)

> Planner additions to the LLD frozen list (shared by 2+ slices, so built by the foundation):
> `src/domain/constants.ts` (CONVENTIONS §5), `src/domain/visibility.ts` (form + responses editor),
> `src/domain/alertRules.ts` (seed + form + alerts + responses), `src/data/local/repos/token.ts`
> (runtime seed + support link creation + form). Signatures unchanged from LLD §1.2, §1.3, §9.

`Context:` lists exactly what the task's agents need to read: spec stories, LLD sections
(by number) and file globs. The Orchestrator builds every brief's `Read:` field from it.

## M1 · Support → customer loop on a phone (incl. Vercel preview)

### T-01 · Foundation: app shell, data layer and shared UI
- Owner: backend-coder, frontend-coder
- Depends on: —
- Files: package.json, pnpm-lock.yaml, next.config.ts, tsconfig.json, eslint.config.mjs, .prettierrc*, .prettierignore, .dependency-cruiser.cjs, vitest.config.ts, playwright.config.ts, postcss.config.mjs, components.json, scripts/check.sh, .env.example, src/config/env.ts, src/domain/types.ts, src/domain/schemas.ts, src/domain/questionnaire.ts, src/domain/answers.ts, src/domain/time.ts, src/domain/visitStatus.ts, src/domain/constants.ts, src/domain/visibility.ts, src/domain/alertRules.ts, src/data/access/**, src/data/local/store.ts, src/data/local/bus.ts, src/data/local/fault.ts, src/data/local/crypto.ts, src/data/local/seed.ts, src/data/local/createLocalDataAccess.ts, src/data/local/repos/auditWriter.ts, src/data/local/db.ts, src/data/local/ids.ts, src/data/local/repoDeps.ts, src/data/local/results.ts, src/data/local/session.ts, src/data/local/repos/** (stubs), src/data/seed/seed.json, src/hooks/**, src/components/ui/**, src/components/shared/**, src/app/** (layout; providers; globals.css; page; robots; not-found; not-allowed; admin/support layouts; placeholder page.tsx for every LLD §0.2 route), tests/support/**, tests/unit/foundation/**, tests/e2e/foundation/**
- Context: SPEC §0, §7 (Navigation, Visual system), §4 Rules for every flow · LLD §0.2, §0.3, §0.4, §0.5, §1.1, §1.2, §1.3, §1.5 (visitStatus, time), §2, §3, §4 (Runtime), §5, §6, §9 (Token) · docs/CONVENTIONS.md · files: /AGENTS.md
- Why separate: the single foundation; every slice builds on its frozen interfaces.
- Status: Done
- Acceptance criteria:
  - [ ] `pnpm dev` → `/` redirects to `/sign-in` (placeholder with the "Demo — sample data" label); with a test session `/admin` shows the AdminShell (sidebar at 1440 px, bottom tab bar at 360 px, every nav item opens a placeholder page), a support session on `/admin` shows "You don't have access to this page", and an unknown URL shows a friendly not-found page with no stack trace (G-W7)
  - [ ] Every LLD §2.2 repo method exists with its LLD signature and returns `UNAVAILABLE` "Not built yet"; `token.ts` encode → decode round-trips; unit tests cover every SPEC F-3 trigger in `visibility` and the alert rules (Q12 = 1 + Q15 = Yes → "Callback requested · Q12 rated 1"; Q3 = Yes alone → none; `reconcileAlert` auto-resolve note text)
  - [ ] Data written through the store is still there after a page reload and from a new store instance (G-02); two tabs writing at once never drop each other's data and a write in one tab refreshes queries in the other (S-06)
  - [ ] With `?demoFail=1` the next write returns `SAVE_FAILED` and `SaveState` shows "Couldn't save, try again" with Retry (S-13)
  - [ ] `scripts/check.sh` runs every CONVENTIONS §6 check and passes (seed check skipped until `scripts/build-seed.ts` exists; `pnpm seed` script declared); gitleaks clean; `.env.example` lists the three LLD §0.5 keys and only `env.ts` reads them (G-04); robots disallow all + noindex meta; `tests/support` provides in-memory Storage, fixed Clock, `signInAs` (sets the session without the UI), `resetDemo`, `openSecondTab`; the minimal `seed.json` (1 admin, 2 support, 1 advisor, `JC-24-1042`) passes `SeedSchema`
- Result: foundation built · 117 unit + 16 e2e · coverage 95% · review 0 crit/0 major · cost not measured (cost tool returned $0)

### T-02 · Sign in to the seeded demo, set a password, reset the demo
- Owner: backend-coder, frontend-coder
- Depends on: T-01
- Files: scripts/build-seed.ts, scripts/seed/answers.ts, scripts/seed/data.ts, scripts/seed/entities.ts, data/seed/Honda_PSF_Survey_30_Dummy_Customer_Responses.xlsx, src/data/seed/seed.json, src/data/local/repos/auth.ts, src/data/local/repos/demo.ts, src/features/auth/**, src/app/sign-in/**, src/app/set-password/**, tests/unit/seed/**, tests/unit/auth/**, tests/e2e/auth/**
- Context: SPEC US-01, US-20 (set-password part), US-22, F-1, F-8, §5 F-1/F-8 rows, §6 · LLD §1.1, §2, §3.1, §4, §5, §6 (RoleGuard, ResetDemoDialog), §7 · files: src/data/local/seed.ts, src/data/local/repos/{auth,demo}.ts, src/components/shared/*, data/seed/Honda_PSF_Survey_30_Dummy_Customer_Responses.xlsx, /AGENTS.md
- Why separate: seed + sign-in is the data every other slice reads; kept apart so support, form and admin slices run in parallel after it.
- Status: Done
- Acceptance criteria:
  - [ ] "Sign in as Support 1" → `/support`, "Sign in as Admin" → `/admin`; `support1@chandrahonda.demo` + demo password (shown as hint) works; wrong password → "Email or password is incorrect"; deactivated user → "Account disabled, contact admin" (G-01); passwords are stored only as hashes and Sign out ends the session (G-W1)
  - [ ] A user with `mustSetPassword` lands on "Set your password"; under 8 characters or a mismatch shows a message and saves nothing (G-05); Save → `/support`, audit `user.set_password` (S-15)
  - [ ] `pnpm seed` builds `seed.json` from the xlsx deterministically (`--check` passes): ~33 responses, Q11 via `ceil(x/2)`, Q15 = Yes on CUST-006/014/022, 2–3 extra rating-1 responses, 4 advisors, 5 models, ~10 unanswered visits (some expired), ~10 job cards with no visit incl. `JC-24-1042` (S-07)
  - [ ] On a fresh load on any day, seed service dates span the 3 months before today, the last 30 days contain responses and some seeded links are still Created/Opened (S-07)
  - [ ] "Reset demo data" (sign-in link and admin More) shows the SPEC US-22 warning → confirm restores the seed and signs out every open tab (US-22, S-06); "Simulate failed save" in More makes the next write fail (S-13)
- Result: sign-in, set password, reset, xlsx seed (33 responses, rebased dates) · 38 e2e · coverage 96.6% · 1 debugger round · cost not measured

### T-01s · Shared change: dealership red accent tokens
- Owner: frontend-coder
- Depends on: T-01
- Files: src/app/globals.css, src/components/shared/ConfirmDialog.tsx, src/components/shared/DemoLabel.tsx, src/components/shared/PasswordPromptDialog.tsx, src/components/shared/SaveState.tsx, src/features/auth/CredentialsForm.tsx, src/features/auth/SetPasswordScreen.tsx (prettier class re-sort only)
- Context: SPEC §7 Visual system (SPEC-input §12 colour rules) · LLD §6 · docs/CONVENTIONS.md
- Why separate: globals.css is frozen; owner asked (T-02 card) for the red accent before round 3.
- Status: Done
- Result: Honda red primary + success/warning/danger tokens, AA contrast · review batched at M1 end · cost not measured
- Acceptance criteria:
  - [ ] `--primary` (buttons, progress, highlights, focus ring) is the dealership red with WCAG AA contrast for its foreground text; neutrals stay slate/white; status tokens success/warning/danger (green/amber/red) are defined and distinct from the brand red; dark-mode token block kept
  - [ ] Screenshots of sign-in and admin shell at 360 and 1440 show red primary buttons; check.sh passes

### T-03 · Support: look up a job card, send the link on WhatsApp, manage my links
- Owner: backend-coder, frontend-coder
- Depends on: T-02
- Files: src/domain/jobCard.ts, src/domain/phone.ts, src/domain/whatsapp.ts, src/data/local/repos/jobCards.ts, src/data/local/repos/visits.ts, src/features/support/**, src/app/support/page.tsx, src/app/support/new/**, tests/unit/support/**, tests/e2e/support/**, tests/unit/foundation/repos.test.ts, src/app/globals.css (whatsapp token, owner-approved rework), src/data/access/repos/visits.ts (VisitSummary ownership field)
- Context: SPEC US-02, US-03, US-04, US-05, US-06, F-2, §5 F-2 rows · LLD §1.5, §2, §5, §6, §8 · files: src/data/local/repos/{token,auditWriter}.ts, src/components/shared/*, /AGENTS.md
- Why separate: own screens (`/support`, `/support/new`) and repos; independent of the form and admin slices.
- Status: Done
- Acceptance criteria:
  - [ ] `JC-24-1042` autofills the SPEC §5 row (Ramesh Kumar · +91 98400 12345 · TN 09 BX 4521 · Activa 6G · Scooter · Paid service · 14 Nov · Suresh) (AC-1); ` jc241042` and `JC 24 1042` find it (S-02); `JC-99-0000` → "Job card not found. Check the number on the job card." and an empty input is blocked (G-01, G-05); the hint lists the fresh seeded job cards (S-07)
  - [ ] Generate → a `/f/<token>` link that opens the customer form for that visit, status Created, expiry 7 days (AC-2); Send on WhatsApp opens exactly the SPEC §5 `wa.me` URL; Copy link shows "Copied" (S-01)
  - [ ] Landline or blank phone: Send is disabled with "Enter a mobile number to send on WhatsApp"; an edited mobile number is used in the `wa.me` link and saved on the visit; Copy still works (S-03)
  - [ ] `/support` lists only my current links (badge, search by job card / reg. no, no ratings or answers anywhere); Support 2 never sees Support 1's links (G-W2); an existing link shows its status with Resend / Regenerate / Cancel, a Completed one shows "Feedback already received"
  - [ ] Regenerate replaces the link (old visit gets `replacedBy`, list shows the new one, audit `link.regenerate`), Resend reopens WhatsApp with the current link (S-05); Cancel (confirm) → Cancelled + audit `link.cancel` (S-14); a failed save shows "Couldn't save, try again" and keeps the edited phone (S-13)
- Result: approved 2026-11-22 · 5/5 goals · 207 unit + 92 e2e (after main merge) · cov 97.1% · ≈$0.78 · merge-main 35% · tester 31% · reviewer 19% · frontend-coder 15%

### T-04 · Customer feedback form on a phone
- Owner: backend-coder, frontend-coder
- Depends on: T-02
- Files: src/data/local/repos/feedback.ts, src/features/feedback-form/**, src/app/f/**, tests/unit/feedback-form/**, tests/e2e/feedback-form/**, tests/unit/foundation/repos.test.ts
- Context: SPEC US-07, US-08, US-09, US-10, US-11, US-12, F-3, F-4 step 1, §5 F-3 rows · LLD §1.2, §1.3, §2, §5, §9 · files: src/domain/{questionnaire,visibility,alertRules}.ts, src/data/local/repos/token.ts, src/components/shared/*, /AGENTS.md
- Why separate: the public `/f/[token]` flow with its own repo; needs no staff screens.
- Status: Done
- Acceptance criteria:
  - [ ] Welcome reads "Hi Ramesh Kumar, how was your Activa 6G's service on 14 Nov?" + "Takes about 2 minutes" and sets the visit to Opened (AC-3); steps show "Step n of 6", faces with label, Yes/No chips, Next disabled until the step is complete, Back keeps answers, tap targets ≥ 48 px, usable at 360 px (AC-11)
  - [ ] Every SPEC F-3 trigger slides its follow-up open/closed; Q1 = 2 opens Q1a; Q7 No → Yes hides Q7a and Q7a is not saved; reloading on step 4 restores answers (S-04, AC-4)
  - [ ] Submit with Q12 = 1, Q15 = Yes → success animation + "Our team will call you soon", visit Completed, one alert "Callback requested · Q12 rated 1" stored (AC-7); Q3 = Yes alone stores no alert
  - [ ] Completed link → "Thank you — already submitted"; seeded 8-day-old link → "This feedback link has expired. Please contact Chandra Honda."; regenerated link → adds "A newer link was sent to you on WhatsApp" (S-05); unknown or cancelled token → "Link not valid" (AC-5, S-14, G-01); a link opened in a fresh browser shows the personal welcome and, after submit, that browser holds the visit, response and alert (S-12)
  - [ ] Text answers stop at 1,000 characters with an `n/1000` counter, accept Tamil and emoji, and `<script>` text is stored and shown as plain text (G-05, G-W3); a failed submit shows "Couldn't save, try again", keeps every answer and Retry succeeds (S-13)
- Result: approved 2026-11-22 · 5/5 goals · 186 unit + 64 e2e · cov 96.87% · ≈$0.28 · tester 67% · reviewer 33%

### T-05 · Public Vercel preview the client can open on a phone
- Owner: devops
- Depends on: T-03, T-04
- Files: vercel.json, docs/DEPLOY.md, .gitignore (.vercel line, owner-approved)
- Context: SPEC §8 (Hosting), §9 (Security & privacy), §10, §12 DoD item 8 · LLD §0.5 · files: .env.example, next.config.ts, /AGENTS.md
- Why separate: needs the owner's Vercel account and the end-to-end loop; no feature code.
- Status: Done
- Acceptance criteria:
  - [ ] **Owner step:** devops stops with plain step-by-step instructions; the owner signs in to their own Vercel account and links the project (the team never sees the password); the task waits in "Needs you" until the owner confirms
  - [ ] `NEXT_PUBLIC_DEMO_PASSWORD`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_DEALER_PHONE` are set in the Vercel project, no values committed (G-04)
  - [ ] The preview URL is served over HTTPS; an unknown path shows the not-found page, no stack trace; `/robots.txt` disallows all and pages carry `noindex` (G-W7)
  - [ ] 360 px captures of the deployed sign-in → `/support/new` → generated `/f/<token>` → thank-you in `.results/T-05/` (DoD item 8); redeploy steps written in `docs/DEPLOY.md`
- Result: approved 2026-11-22 · live https://chandra-psf.vercel.app · 4/4 goals · ≈$0.70

## M2 · Admin console

### T-06 · Admin overview: KPI tiles, 7 analytics blocks and filters
- Owner: backend-coder, frontend-coder
- Depends on: T-02
- Files: src/domain/metrics/**, src/data/local/repos/analytics.ts, src/features/admin-overview/**, src/app/admin/page.tsx, tests/unit/admin-overview/**, tests/e2e/admin-overview/**, tests/unit/foundation/repos.test.ts, tests/e2e/foundation/shell.spec.ts
- Context: SPEC US-14, US-15, US-16, F-5, §5 F-5 rows · LLD §1.4, §2, §5, §6 (FilterBar, MetricValue, EmptyState), §10 · files: src/domain/{types,constants}.ts, src/components/shared/*, /AGENTS.md
- Why separate: own route, repo and metric functions; runs beside the other admin slices.
- Status: Done
- Acceptance criteria:
  - [ ] SPEC §5 metric examples pass: Q1 4, 5, 3 → 75, 100, 50; Q2 Yes/Partially/No → 100/50/0; 40 visits with 30 completed → 75 %; Q3 reversed; cancelled and replaced visits are left out of the response rate (S-14) and a deleted response does not count as completed (S-09)
  - [ ] Default "last 30 days" shows 5 KPI tiles with green/red arrows vs the previous same-length period and all 7 blocks filled with seed data; advisor table sorts; problem breakdown has a follow-up selector (AC-10, S-07)
  - [ ] Every filter (date range, vehicle type, model, advisor) changes every block and is kept in the URL; all blocks filter on the visit's service date (S-11)
  - [ ] A filter matching nothing shows "—" and "No responses for these filters", no arrows, never 0 %, NaN or ∞ (S-10); Recent comments show `<script>` as plain text (G-W3)
  - [ ] A support session gets `FORBIDDEN` from `getAnalytics` and is redirected to the `/not-allowed` page with no data shown when opening `/admin` (G-W2, AC-6; D-15); single column at 360 px, grid at 1440 px
- Result: approved 2026-11-22 · 5/5 goals · 253 unit + 122 e2e · cov 97.6% · ≈$1.67 · frontend-coder 49% · backend-coder 42% · merge-main 9%

### T-07 · Alerts queue with status, notes and nav badge
- Owner: backend-coder, frontend-coder
- Depends on: T-02
- Files: src/data/local/repos/alerts.ts, src/features/admin-alerts/**, src/app/admin/alerts/**, tests/unit/admin-alerts/**, tests/e2e/admin-alerts/**, tests/unit/foundation/repos.test.ts, tests/e2e/foundation/shell.spec.ts
- Context: SPEC US-12, US-13, F-4, §5 F-4 row · LLD §1.3, §2, §5, §6 (StatusBadge, SaveState, EmptyState), §11 · files: src/domain/alertRules.ts, src/data/local/repos/auditWriter.ts, src/components/shared/*, /AGENTS.md
- Why separate: own route and repo; the nav badge hook is already in the foundation.
- Status: Done
- Acceptance criteria:
  - [ ] `/admin/alerts` lists alerts newest first with a status filter and rows tinted by status; the nav badge shows the open count and updates after each change (AC-8)
  - [ ] Priya S. → Contacted with note "Called, bike rechecked 22 Nov" → row amber, audit `alert.status · open → contacted` and `alert.note` (AC-8); Resolved can be reopened to Open
  - [ ] The drawer shows customer, phone, vehicle, reasons and links to `/admin/responses/<id>`; alerts of deleted responses are hidden; no alerts → "No alerts — all customers happy"
  - [ ] A failed save keeps the typed note and shows "Couldn't save, try again" (S-13); a support session gets `FORBIDDEN` from every alert method (G-W2)
- Result: approved 2026-11-22 (batch) · 4/4 goals · 214 unit + 106 e2e · ≈$0.76 · frontend-coder 57% · backend-coder 43%

### T-06s · Shared change: retire foundation stub checks for responses and audit
- Owner: tester
- Depends on: T-06
- Files: tests/unit/foundation/repos.test.ts, tests/e2e/foundation/shell.spec.ts
- Context: T-08 and T-09 both need these files (NEEDS FILE); one edit on main avoids a merge conflict
- Why separate: shared files claimed by two running tasks
- Status: Done
- Acceptance criteria:
  - [ ] No "Not built yet" stub rows for responses.* or audit.listAudit remain; other stub rows kept, it.each non-empty
  - [ ] No "Coming soon" assertions remain for /admin/responses or /admin/audit (removed, not replaced); main's check.sh passes
- Result: approved 2026-11-22 · 2/2 goals · test files only

### T-08 · Responses: browse, edit with password, delete and restore
- Owner: backend-coder, frontend-coder
- Depends on: T-02, T-03
- Files: src/data/local/repos/responses.ts, src/features/admin-responses/**, src/app/admin/responses/**, tests/unit/admin-responses/**, tests/e2e/admin-responses/**
- Context: SPEC US-16 (Responses table), US-17, US-18, US-21, F-6, F-4 step 4, §5 F-6 rows, §13 · LLD §1.2, §1.3, §2, §5, §6 (PasswordPromptDialog, ConfirmDialog, FilterBar), §8 (VisitSummary), §12 · files: src/domain/{visibility,alertRules}.ts, src/data/local/repos/{visits,auditWriter}.ts (imports `toVisitSummary(visit, jobCard, now)` from visits.ts without editing it), src/components/shared/*, /AGENTS.md
- Why separate: own routes and repo; depends on T-03 only for the `VisitSummary` mapper in `repos/visits.ts`.
- Status: In progress
- Acceptance criteria:
  - [ ] `/admin/responses` table filters by service date, vehicle type, model, advisor (S-11, AC-10); a row opens the detail with every answer incl. follow-ups and visit + vehicle info; long text truncated in the list, full on detail; `<script>` shown as plain text (G-W3)
  - [ ] Edit Q6 2 → 4 with the correct password: Q6a disappears live, audit `response.edit` old `{Q6:2,Q6a:["Rude"]}` new `{Q6:4}`; wrong password → "Password incorrect" and nothing saved (AC-9, G-01)
  - [ ] Edit Q12 1 → 4 on an only-reason alert → alert Resolved with "Auto-resolved: no alert reason after edit" audited; edit Q15 No → Yes → new Open alert "Callback requested", badge +1 (S-08)
  - [ ] Delete (confirm + password) moves the response to Recently deleted and out of the table; Restore (password) brings back its answers and its alert with the previous status; audit `response.delete` then `response.restore`; empty list → "Nothing deleted" (US-21, G-03)
  - [ ] A failed edit keeps the edited answers and shows "Couldn't save, try again" (S-13); a support session gets `FORBIDDEN` from every response method (G-W2)
- Result: —

### T-09 · Audit log
- Owner: backend-coder, frontend-coder
- Depends on: T-02
- Files: src/data/local/repos/audit.ts (read side; listAudit only), src/features/admin-audit/**, src/app/admin/audit/**, tests/unit/admin-audit/**, tests/e2e/admin-audit/**
- Context: SPEC US-19, F-6 step 5 · LLD §1.1 (AuditEntry), §2, §5, §6 (EmptyState), §13 · files: src/data/local/repos/{audit,auditWriter}.ts, src/components/shared/*, /AGENTS.md
- Why separate: own route and read-only repo method; small but independent of every other admin slice.
- Status: In progress
- Acceptance criteria:
  - [ ] `/admin/audit` lists time (IST), actor, action, entity and old → new, newest first, with seeded entries after a reset
  - [ ] Filter by action narrows the list; long old/new values are truncated with "Show more"
  - [ ] There are no edit or delete controls and `AuditRepo` exposes no write method; a support session gets `FORBIDDEN` (G-W2)
- Result: —

### T-10 · Manage support users
- Owner: backend-coder, frontend-coder
- Depends on: T-02
- Files: src/data/local/repos/users.ts, src/features/admin-users/**, src/app/admin/users/**, tests/unit/admin-users/**, tests/e2e/admin-users/**
- Context: SPEC US-20, F-7, F-1 step 3 · LLD §2, §5, §6 (SaveState), §7 (SessionReader behaviour), §14 · files: src/data/local/repos/auth.ts, src/components/shared/*, /AGENTS.md
- Why separate: own route and repo; depends on T-02 for the set-password screen used in S-15.
- Status: Backlog
- Acceptance criteria:
  - [ ] Add "Deepa R." (`deepa@chandrahonda.demo`, `Welcome@1`) → listed; signing in as her opens "Set your password", then `/support` (S-15); `user.create` audited
  - [ ] Adding `SUPPORT1@chandrahonda.demo` → "Email already in use" (G-01); empty name, invalid email or a temp password under 8 characters is rejected (G-05)
  - [ ] Deactivating Support 2 drops his open session and his next sign-in shows "Account disabled, contact admin"; reactivate restores access; the admin cannot deactivate themself; each change audited (S-15)
  - [ ] A failed save keeps the form contents and shows "Couldn't save, try again" (S-13); a support session gets `FORBIDDEN` (G-W2)
- Result: —

### T-11 · Wire-up: Definition-of-done walkthrough across all screens
- Owner: frontend-coder
- Depends on: T-03, T-04, T-06, T-07, T-08, T-09, T-10
- Files: tests/e2e/walkthrough/**
- Context: SPEC §12, §5 (F-6 delete/restore row, two-tab row), §7 · LLD §0.0, §2.4, §3.2 · files: tests/support/*, docs/scenarios.md, /AGENTS.md
- Why separate: the one whole-app check that needs every feature; no feature edits (fixes raise `Needs file:` on the owning slice).
- Status: Backlog
- Acceptance criteria:
  - [ ] Two tabs: a submission in tab B shows as Completed in tab A's support list and raises tab A's alert badge without reload; then moving another alert to Contacted in tab A keeps tab B's response and alert (S-06)
  - [ ] Same browser: support generates a link → opening it shows Opened → submit with Q6 = 1, Q15 = Yes → alert in `/admin/alerts` → Contacted → Resolved, each in `/admin/audit` (AC-3, AC-7, AC-8, S-12)
  - [ ] Delete CUST-014's response → Overview "Responses received" drops by 1, response rate updates and its alert leaves the queue; Restore brings all three back; audit shows `response.delete` then `response.restore` (S-09)
  - [ ] 360 px and 1440 px screenshots of every SPEC §7 screen in `.results/T-11/` and an accessibility check (labelled inputs) passes (G-W5); a support session is redirected to `/not-allowed` from every `/admin` URL, no data shown (AC-6; D-15)
- Result: —

### T-12 · README and presenter guide
- Owner: docs
- Depends on: T-05
- Files: README.md, docs/DEMO-GUIDE.md
- Context: SPEC §0, §8, §12, §13 · LLD §0.5 · files: .env.example, docs/DEPLOY.md, package.json
- Why separate: documentation only; written once the deploy steps exist.
- Status: Done
- Acceptance criteria:
  - [ ] A fresh clone runs with the README's commands (`pnpm install`, `pnpm dev`, `scripts/check.sh`) (G-06)
  - [ ] README states the data-safety choice: no backup, data lives only in this browser until "Reset demo data", other devices don't see it (G-03)
  - [ ] `docs/DEMO-GUIDE.md` covers demo logins (from `.env.example`), fresh job cards to use, the two-tab demo, the cross-device limitation, "Simulate failed save" and the public link
- Result: approved 2026-11-22 (batch) · 3/3 goals · docs only · ≈$1.12 · docs 100%
