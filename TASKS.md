# TASKS — Chandra Honda PSF (phase 1 demo · phase 2 production, CR-1)

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

Size: phase 1 medium (cap 15) · 12 tasks, all Done · phase 2 (CR-1) large (cap 30) · 31 tasks (one over: see T-18 `Why separate`) · production gate: `docs/PRODUCTION.md`

Frozen: package.json, pnpm-lock.yaml, next.config.ts, src/app/layout.tsx, src/app/providers.tsx, src/app/globals.css, src/app/admin/layout.tsx, src/app/support/layout.tsx, src/components/ui/**, src/components/shared/**, src/hooks/**, src/data/access/**, src/data/remote/**, src/domain/types.ts, src/domain/schemas.ts, src/domain/questionnaire.ts, src/domain/answers.ts, src/domain/time.ts, src/domain/visitStatus.ts, src/domain/constants.ts, src/domain/visibility.ts, src/domain/alertRules.ts, src/domain/roles.ts, src/domain/jobCardInput.ts, src/domain/models.ts, src/domain/passwordPolicy.ts, src/domain/retention.ts, src/domain/erasure.ts, src/config/env.ts, src/server/env.ts, src/server/log.ts, src/server/ctx.ts, src/server/scope.ts, src/server/audit.ts, src/server/tokens.ts, src/server/rateLimit.ts, src/server/erasure.ts, src/server/csv.ts, src/server/createServerDataAccess.ts, src/server/db/**, src/server/auth/**, src/server/rpc/index.ts, src/app/api/rpc/**, src/proxy.ts, drizzle/**, drizzle.config.ts, vercel.json, scripts/migrate.ts, scripts/admin.ts, tests/support/**, gate configs (tsconfig.json; eslint.config.mjs; prettier config; .dependency-cruiser.cjs; vitest.config.ts; playwright.config.ts; postcss.config.mjs; components.json; scripts/check.sh; .env.example)

> CR-1: Frozen line = LLD-phase2 "Frozen after the phase-2 foundation" plus the phase-1 list minus the
> files T-01b deletes (`src/data/local/**`). The phase-2 entries are built by T-15…T-18, T-01b and T-22;
> `src/server/tokens.ts` is built by T-03c, `src/server/csv.ts` by T-24 and `src/server/erasure.ts` by
> T-25 (only their slices and the cron use them). Every task that changes a frozen path claims it in
> its own `Files:`; each feature slice claims its own `src/data/access/repos/<name>.ts`.
> `drizzle/**` is serial: only T-15 writes migrations in this plan.

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
- Status: Done
- Acceptance criteria:
  - [ ] `/admin/responses` table filters by service date, vehicle type, model, advisor (S-11, AC-10); a row opens the detail with every answer incl. follow-ups and visit + vehicle info; long text truncated in the list, full on detail; `<script>` shown as plain text (G-W3)
  - [ ] Edit Q6 2 → 4 with the correct password: Q6a disappears live, audit `response.edit` old `{Q6:2,Q6a:["Rude"]}` new `{Q6:4}`; wrong password → "Password incorrect" and nothing saved (AC-9, G-01)
  - [ ] Edit Q12 1 → 4 on an only-reason alert → alert Resolved with "Auto-resolved: no alert reason after edit" audited; edit Q15 No → Yes → new Open alert "Callback requested", badge +1 (S-08)
  - [ ] Delete (confirm + password) moves the response to Recently deleted and out of the table; Restore (password) brings back its answers and its alert with the previous status; audit `response.delete` then `response.restore`; empty list → "Nothing deleted" (US-21, G-03)
  - [ ] A failed edit keeps the edited answers and shows "Couldn't save, try again" (S-13); a support session gets `FORBIDDEN` from every response method (G-W2)
- Result: approved 2026-11-22 after owner rework (4 fixes) · 5/5 goals · 286 unit + 164 e2e · cov 97.8% · ≈$2.84 · tester 46% · frontend-coder 27% · backend-coder 15% · reviewer 11%

### T-09 · Audit log
- Owner: backend-coder, frontend-coder
- Depends on: T-02
- Files: src/data/local/repos/audit.ts (read side; listAudit only), src/features/admin-audit/**, src/app/admin/audit/**, tests/unit/admin-audit/**, tests/e2e/admin-audit/**
- Context: SPEC US-19, F-6 step 5 · LLD §1.1 (AuditEntry), §2, §5, §6 (EmptyState), §13 · files: src/data/local/repos/{audit,auditWriter}.ts, src/components/shared/*, /AGENTS.md
- Why separate: own route and read-only repo method; small but independent of every other admin slice.
- Status: Done
- Acceptance criteria:
  - [ ] `/admin/audit` lists time (IST), actor, action, entity and old → new, newest first, with seeded entries after a reset
  - [ ] Filter by action narrows the list; long old/new values are truncated with "Show more"
  - [ ] There are no edit or delete controls and `AuditRepo` exposes no write method; a support session gets `FORBIDDEN` (G-W2)
- Result: approved 2026-11-22 · 3/3 goals · 134 e2e · ≈$0.35 · frontend-coder 68% · backend-coder 32%

### T-10 · Manage support users
- Owner: backend-coder, frontend-coder
- Depends on: T-02
- Files: src/data/local/repos/users.ts, src/features/admin-users/**, src/app/admin/users/**, tests/unit/admin-users/**, tests/e2e/admin-users/**, tests/unit/foundation/repos.test.ts, tests/e2e/foundation/shell.spec.ts
- Context: SPEC US-20, F-7, F-1 step 3 · LLD §2, §5, §6 (SaveState), §7 (SessionReader behaviour), §14 · files: src/data/local/repos/auth.ts, src/components/shared/*, /AGENTS.md
- Why separate: own route and repo; depends on T-02 for the set-password screen used in S-15.
- Status: Done
- Acceptance criteria:
  - [ ] Add "Deepa R." (`deepa@chandrahonda.demo`, `Welcome@1`) → listed; signing in as her opens "Set your password", then `/support` (S-15); `user.create` audited
  - [ ] Adding `SUPPORT1@chandrahonda.demo` → "Email already in use" (G-01); empty name, invalid email or a temp password under 8 characters is rejected (G-05)
  - [ ] Deactivating Support 2 drops his open session and his next sign-in shows "Account disabled, contact admin"; reactivate restores access; the admin cannot deactivate themself; each change audited (S-15)
  - [ ] A failed save keeps the form contents and shows "Couldn't save, try again" (S-13); a support session gets `FORBIDDEN` (G-W2)
- Result: approved 2026-11-22 · 4/4 goals · cov 97.9% · ≈$1.16 · tester 49% · frontend-coder 26% · backend-coder 13% · reviewer 13%

### T-06r · Fix: Overview "Open alerts" counts alerts of deleted responses
- Owner: backend-coder
- Depends on: T-06, T-08
- Files: src/data/local/repos/analytics.ts, tests/unit/admin-overview/**
- Context: found by T-11 walkthrough (S-09): after deleting r-s005 the KPI stays 3, alerts queue shows 2 · LLD §5, §9 · files: src/data/local/repos/alerts.ts, src/data/local/repos/responses.ts
- Why separate: bug in an approved slice; T-11 adds no feature edits
- Status: Done
- Acceptance criteria:
  - [ ] "Open alerts" KPI excludes alerts whose response is soft-deleted, matching the alerts queue; restore brings it back
  - [ ] Regression unit test; scripts/check.sh passes
- Result: approved 2026-11-22 · 2/2 goals · 287 unit + 164 e2e · ≈$0.23 · tester 53% · reviewer 27% · backend-coder 21%

### T-11 · Wire-up: Definition-of-done walkthrough across all screens
- Owner: frontend-coder
- Depends on: T-03, T-04, T-06, T-07, T-08, T-09, T-10
- Files: tests/e2e/walkthrough/**
- Context: SPEC §12, §5 (F-6 delete/restore row, two-tab row), §7 · LLD §0.0, §2.4, §3.2 · files: tests/support/*, docs/scenarios.md, /AGENTS.md
- Why separate: the one whole-app check that needs every feature; no feature edits (fixes raise `Needs file:` on the owning slice).
- Status: Done
- Acceptance criteria:
  - [ ] Two tabs: a submission in tab B shows as Completed in tab A's support list and raises tab A's alert badge without reload; then moving another alert to Contacted in tab A keeps tab B's response and alert (S-06)
  - [ ] Same browser: support generates a link → opening it shows Opened → submit with Q6 = 1, Q15 = Yes → alert in `/admin/alerts` → Contacted → Resolved, each in `/admin/audit` (AC-3, AC-7, AC-8, S-12)
  - [ ] Delete CUST-014's response → Overview "Responses received" drops by 1, response rate updates and its alert leaves the queue; Restore brings all three back; audit shows `response.delete` then `response.restore` (S-09)
  - [ ] 360 px and 1440 px screenshots of every SPEC §7 screen in `.results/T-11/` and an accessibility check (labelled inputs) passes (G-W5); a support session is redirected to `/not-allowed` from every `/admin` URL, no data shown (AC-6; D-15)
- Result: approved 2026-11-22 · 4/4 goals · 182 e2e · 46 screenshots · ≈$0.92 · frontend-coder 100%

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

### T-12s · Shared change: handover minors in frozen files
- Owner: backend-coder, frontend-coder
- Depends on: T-11
- Files: src/config/env.ts, src/data/access/repos/feedback.ts, src/data/local/repos/token.ts, src/hooks/useFiltersFromUrl.ts, tests/unit/foundation/token.test.ts, tests/unit/foundation/filters.test.ts, tests/unit/foundation/config.test.ts, tests/unit/hooks/**, src/hooks/useSession.ts
- Context: STATE.md Known minors (T-01 token/dateOf, M1 feedback comment, T-12 env fallback); frozen files need a T-xx claim
- Why separate: frozen shared code
- Status: Done
- Acceptance criteria:
  - [ ] token.ts strict ISO-8601; dateOf rejects impossible dates; feedback.ts comment documents CONFLICT; env.ts dev fallback (production strict)
  - [ ] tests for each; scripts/check.sh passes
- Result: approved 2026-11-22 · 2/2 goals · review 0 major · ≈$0.35 · implement-backend 31% · review 23% · implement-frontend 22% · session-key 13% · review-minors 11%

### T-12t · Shared change: empty sample APP_URL in .env.example
- Owner: devops
- Depends on: T-12s
- Files: .env.example, tests/unit/foundation/config.test.ts, src/config/env.ts, tests/unit/foundation/repos.test.ts, tests/support/env.ts, tests/e2e/support/support.spec.ts
- Context: owner decision at handover; the dev fallback (T-12s) uses .env.example values, so local WhatsApp links pointed at psf-demo.vercel.app
- Why separate: .env.example is a frozen gate file
- Status: Done
- Acceptance criteria:
  - [ ] NEXT_PUBLIC_APP_URL in .env.example is empty (app uses the page's own address); a comment explains it's optional
  - [ ] config.test.ts expects the new fallback; scripts/check.sh passes
- Result: approved 2026-11-22 · 2/2 goals · check passes

### handover · Handover: known minors, CI, as-built docs, owner guide
- Owner: devops, backend-coder, frontend-coder, tester, architect, docs
- Depends on: T-11
- Files: .github/workflows/ci.yml, src/config/env.ts, src/data/access/repos/feedback.ts, src/data/local/repos/token.ts, src/data/local/repos/auth.ts, src/data/local/repos/alerts.ts, src/data/local/repos/analytics.ts, src/data/local/repos/users.ts, src/data/local/repos/responses.ts, src/features/**, src/hooks/**, src/domain/**, tests/**, docs/**, README.md, OWNER.md
- Context: stage 8 handover · STATE.md Known minors · .results/handover/batched-review-reviewer.md
- Why separate: final handover task
- Status: Done
- Acceptance criteria:
  - [ ] Every known minor of ≈5 min or less fixed; larger ones on the handover card
  - [ ] CI, as-built LLD/ARCHITECTURE/WALKTHROUGH, README, OWNER.md, PRODUCTION gate; handover lint clean
- Result: approved 2026-11-22 · CI, ~30 minors fixed, as-built docs, OWNER.md, PRODUCTION gate 0 open, fresh clone 11/11 · ≈$6.74

## M3 · Empty system you can sign into, on a preview deploy

### T-13 · Freeze the demo before the first phase-2 merge
- Owner: devops
- Depends on: —
- Files: docs/DEPLOY.md (demo section)
- Context: SPEC §0, §0.1 · LLD-phase2 §27 · files: docs/DEPLOY.md, vercel.json
- Why separate: owner's Vercel account; gates every later merge to main. The tag and branch are git writes made by the Orchestrator / git-pr; devops only writes the owner steps.
- Status: Done
- Acceptance criteria:
  - [ ] Tag `demo-v1` on current main and branch `demo` from it exist (made by the Orchestrator / git-pr) (S-28)
  - [ ] **Owner step:** devops stops with plain steps; the owner sets the demo Vercel project `chandra-psf` to deploy from `demo` (or turns its Git deploys off); the task waits in "Needs you" until the owner confirms
  - [ ] A test push to main does not redeploy https://chandra-psf.vercel.app; `docs/DEPLOY.md` records how the demo is frozen and how to take it offline at launch
- Result: approved 2026-11-22 · 3/3 goals · demo-v1 + demo at 67ceeb1; demo not Git-connected (owner confirmed) · ≈$0.23 · implement 37% · deploy-doc-2 37% · deploy-doc 26%

### T-14 · Env setup: approved packages, Neon free project, PGlite
- Owner: env-setup
- Depends on: T-13
- Files: package.json, pnpm-lock.yaml, .env.example, .gitignore, tests/unit/foundation/config.test.ts
- Context: LLD-phase2 §15.4, §15.5, §16.2 · files: package.json, .env.example
- Why separate: package installs are env-setup only; needs the owner's Neon account.
- Status: Done
- Acceptance criteria:
  - [ ] drizzle-orm 0.45.4, @neondatabase/serverless 1.2.1, @node-rs/argon2 2.2.2, server-only 0.0.1, dev drizzle-kit 0.31.11 and @electric-sql/pglite pinned exactly (licence recorded); argon2's native build allowed in pnpm settings; `pnpm install --frozen-lockfile` works on a fresh clone; scripts `db:generate`, `db:migrate`, `admin`, `golive:check` declared
  - [ ] **Owner step:** the owner signs up to Neon with their own account and creates project `chandra-psf` in the Singapore region (free plan) with branches `main` and `dev`; the team never sees the password or connection strings; the task waits in "Needs you"
  - [ ] `.env.example` documents every LLD §15.5 key with placeholders (local `DATABASE_URL=pglite:./.pglite`), `.pglite*` is git-ignored; gitleaks clean; `CHECK_NO_COVERAGE=1 scripts/check.sh` passes (G-04)
- Result: approved 2026-11-22 · 3/3 goals · packages pinned, Neon production+dev (owner) · ≈$0.31 · env-setup 54% · env-test 46%

### T-15 · Database foundation: schema, init migration, db client, migrate script
- Owner: backend-coder
- Depends on: T-14
- Files: src/server/db/**, src/server/env.ts, src/server/log.ts, drizzle/**, drizzle.config.ts, scripts/migrate.ts, scripts/check.sh (migrations-in-sync step), tests/support/pglite.ts, tests/unit/server/db/**, tests/unit/foundation/config.test.ts, vitest.config.ts
- Context: LLD-phase2 §15.2, §15.5, §16, §16.1, §16.2 · CONVENTIONS §5 (P2 database and logging) · files: .env.example, src/config/env.ts
- Why separate: the schema is the data every slice reads and locks the data model (M3 checkpoint); migrations are serial.
- Status: Done
- Acceptance criteria:
  - [ ] `pnpm db:migrate` on a fresh PGlite creates all 14 LLD §16.1 tables, enums and indexes from `drizzle/0000_init.sql`; check.sh's migrations-in-sync step passes (`drizzle-kit generate` adds nothing)
  - [ ] Tests on PGlite prove these are rejected: duplicate `lower(email)`; duplicate job card key in one branch (the same number in two branches is allowed); two live tokens for one visit; a main admin with a branch
  - [ ] `audit_log` rejects DELETE and any UPDATE unless `psf.redact = 'on'` (then only old/new/note)
  - [ ] `src/server/env.ts` rejects `pglite:` when `VERCEL_ENV=production` and missing production secrets; `log.ts` writes JSON lines with ids and counts only (a test proves a name or phone field is refused)
- Result: approved 2026-11-22 · 4/4 goals · 375 tests · cov 98.2% · review 0 major · ≈$2.23 · backend-coder 30% · review 25% · review-fix-tests 13% · tests 10% · check-gate 6% · coverage-gate 6% · review-fix-backend 5% · review-fix-gate 5%

### T-16 · Phase-2 domain rules (pure)
- Owner: backend-coder
- Depends on: T-13
- Files: src/domain/roles.ts, src/domain/jobCardInput.ts, src/domain/models.ts, src/domain/passwordPolicy.ts, src/domain/retention.ts, src/domain/erasure.ts, src/domain/constants.ts, tests/unit/domain/phase2/**, src/domain/commonPasswords.ts
- Context: SPEC F-2 field table, §5 F-2 and F-10 rows, US-28, US-31 · LLD-phase2 §17.2 (§1.1 Role row), §18.1, §22, §24, §25 · files: src/domain/types.ts, src/domain/constants.ts, src/domain/phone.ts, src/domain/jobCard.ts
- Why separate: pure functions shared by job cards, users, cron and erasure; runs beside T-14 and T-15.
- Status: Done
- Acceptance criteria:
  - [ ] `jobCardInputSchema(now)` with the SPEC §5 rows: `tn09bx4521` → "TN 09 BX 4521"; `98400 12345` → +91 98400 12345; 25 Nov 2026 entered on 22 Nov → "Service date can't be in the future"; 61 days ago rejected; model "Other" needs a name and a vehicle type
  - [ ] `passwordProblem`: under 8 characters → too_short, a top-1000 password (any case) → too_common; `isAdmin` / `isMainAdmin` correct for the three roles
  - [ ] Retention cut-offs (IST dates): served 14 Nov 2026 unanswered → due 12 Feb 2027; answered → 14 Nov 2029; `stripFreeText` drops Q14, Q2a, Q13a and every `.text` and keeps ratings and chips
  - [ ] Idle, lockout, rate-limit and retention numbers are named constants (CONVENTIONS §5)
- Result: approved 2026-11-22 (batch) · 4/4 goals · 333 unit · ≈$0.62 · backend-coder 100%

### T-17 · Server core: request context, sessions, scope, audit writer
- Owner: backend-coder
- Depends on: T-15, T-16
- Files: src/server/ctx.ts, src/server/scope.ts, src/server/audit.ts, src/server/auth/session.ts, src/server/auth/cookies.ts, tests/support/serverCtx.ts, tests/unit/server/core/**
- Context: LLD-phase2 §17.1, §18.2, §19 · CONVENTIONS §2 (P2), §3 · files: src/server/db/**, src/domain/roles.ts, src/domain/constants.ts
- Why separate: every server repo builds on `RequestCtx`, `Scope` and sessions; kept under ~400 changed lines apart from the transport (T-18).
- Status: Done
- Acceptance criteria:
  - [x] The session token is 32 random bytes and only its SHA-256 is stored; cookie `__Host-psf_session` (production) is httpOnly, Secure, SameSite=Lax, 7 days; a test proves the raw token is never in the database or the log
  - [x] `readSession` rejects: inactive user, inactive branch, support idle > 2 h, admin idle > 12 h, > 7 days since sign-in (S-27); touch moves `last_active_at` at most once per 60 s
  - [x] `scopeOf`, `requireStaff` / `requireAdmin` / `requireMainAdmin`, `branchFilter` (a branch user's `wanted` branch is ignored) and `inScope` are covered by the LLD §19 table
  - [x] `guard(fn)` maps thrown errors to `SAVE_FAILED` / `UNAVAILABLE` and logs the error class only; the audit writer stamps actor, branch and time
- Result: 4/4 goals · 42 tests · coverage 98.27% · review 0 major, 1 minor · ≈$1.14 · tester 42% · backend-coder 42% · reviewer 15%

### T-18 · RPC transport, remote client and server stubs
- Owner: backend-coder
- Depends on: T-17
- Files: src/server/rpc/**, src/server/repos/** (UNAVAILABLE stubs), src/server/createServerDataAccess.ts, src/server/rateLimit.ts, src/app/api/rpc/**, src/data/remote/createRemoteDataAccess.ts, src/data/remote/rpcClient.ts, next.config.ts (security headers), .dependency-cruiser.cjs, eslint.config.mjs, tests/unit/server/rpc/**, tests/unit/remote/**
- Context: LLD-phase2 §15.3, §17.1, §17.3, §18.5 (headers) · CONVENTIONS §2 (P2) · files: src/data/access/**, src/server/ctx.ts, src/server/scope.ts
- Why separate: the 31st task (cap 30): the server core and the transport together exceed the ~400-line limit of one session; it is the only data door (CSRF) and needs its own review.
- Status: Done
- Acceptance criteria:
  - [x] `POST /api/rpc/<repo>/<method>`: wrong Origin → 403; unknown method → 404; bad args → `VALIDATION`; staff method without a session → `UNAUTHENTICATED`; stub method → `UNAVAILABLE`; every reply has `Cache-Control: no-store` (G-W1, G-W2)
  - [x] The per-IP flood limit of 300/h on public methods returns `RATE_LIMITED`; the IP is stored only as an HMAC with `IP_HASH_PEPPER`
  - [x] Remote client: a network failure → `SAVE_FAILED` or `UNAVAILABLE` by method kind; it sends `x-psf-active`; `UNAUTHENTICATED` invalidates the session query
  - [x] The LLD §15.3 layer rules (server-hidden, server-no-ui, remote-hidden, repos-via-root) and the ESLint import bans fail the check on a planted violation; the LLD §18.5 security headers are present
- Result: 4/4 goals · coverage 95.27% · e2e 182 · review 0 major, 8 minor · gate files by env-setup · ≈$1.95 · backend-coder 38% · tester 37% · reviewer 16% · gate-config 9%

### T-01b · Switch the app to the server and remove the demo code
- Owner: backend-coder, frontend-coder, env-setup
- Depends on: T-18
- Files: next.config.ts, src/domain/types.ts, src/domain/schemas.ts, src/data/access/**, src/data/local/**, src/data/seed/**, scripts/build-seed.ts, scripts/seed/**, data/seed/**, src/server/createServerDataAccess.ts, src/server/repos/branches.ts, src/server/repos/advisors.ts, src/server/repos/customers.ts, src/server/rpc/index.ts, src/server/rpc/branches.ts, src/server/rpc/advisors.ts, src/server/rpc/customers.ts, src/app/providers.tsx, src/config/env.ts, .env.example, package.json, pnpm-lock.yaml, scripts/check.sh, .dependency-cruiser.cjs, src/components/shared/**, src/hooks/**, src/data/remote/createRemoteDataAccess.ts, src/server/repos/auth.ts, src/server/rpc/auth.ts, src/features/admin-audit/auditFormat.ts, src/features/admin-users/UserRow.tsx, src/features/auth/**, src/features/support/**, src/app/sign-in/**, src/app/admin/layout.tsx, src/app/support/layout.tsx, src/app/account/** (placeholder), src/app/admin/branches/** (placeholder), src/app/admin/advisors/** (placeholder), src/app/admin/customers/** (placeholder), tests/support/**, tests/unit/** (retire tests of deleted code), tests/e2e/** (demo specs deleted; feature specs test.fixme with the rebuilding task id)
- Context: SPEC §0.1, §7 Navigation · LLD-phase2 §17.2 (§1.1, §2.1, §2.2 rows), §19 (roles), §27 · CONVENTIONS §2 · files: src/app/providers.tsx, src/components/shared/*
- Why separate: the single switch point; nothing runs on the server until it lands and every slice needs it. env-setup removes exceljs (installs and removals are env-setup only).
- Status: Done
- Acceptance criteria:
  - [x] `pnpm dev` on PGlite → `/sign-in` shows email + password only: no picker, no password hint, no "Demo — sample data" label, no Reset demo data; admin More has no Simulate failed save; `/support/new` has no fresh job card hint (SPEC §0.1, DoD last item)
  - [x] `src/data/local`, the seed files, exceljs, `NEXT_PUBLIC_DEMO_PASSWORD` / `NEXT_PUBLIC_APP_URL` and check.sh's seed step are gone; only `providers.tsx` imports `@/data/remote`; check.sh passes
  - [x] LLD §17.2 shared types applied (three roles + branch, `Branch`, new audit actions, error codes, topics); `DataAccess` loses demo and gains branches / advisors / customers (stubbed on the server); nav shows Branches and Customers to main admins only, Advisors to branch admins, My account in both portals (placeholder pages)
  - [x] Shared hook and screen unit tests run on `tests/support/fakeDataAccess.ts`; every phase-1 feature e2e spec is either deleted (demo-only) or `fixme` with the id of the rework task that rebuilds it
- Result: 4/4 goals (signed-in nav unit-tested only until T-19) · coverage 94.12% · 12 e2e specs fixme→rebuild tasks · review 0 major, 3 minor · Advisor branchId/active added on owner request · ≈$2.65 · tester 40% · frontend-coder 23% · backend-coder 19% · reviewer 12% · env-setup 5% · rework-advisor 3%

### T-19 · First admin from nothing: setup script + e2e harness
- Owner: backend-coder, tester
- Depends on: T-01b
- Files: scripts/admin.ts, tests/unit/server/admin/**, playwright.config.ts, tests/support/e2e.ts, tests/e2e/global-setup.ts
- Context: SPEC US-23, F-9 step 1, §5 F-9 rows · LLD-phase2 §26 (`scripts/admin.ts`) · CONVENTIONS §5 (P2 tests) · files: src/server/db/**, src/server/audit.ts, src/domain/questionnaire.ts
- Why separate: setup is a maintainer tool outside the app (a back door if wrong); the e2e harness every later slice uses needs it.
- Status: Done
- Acceptance criteria:
  - [x] `admin init --name --email` on an empty database installs questionnaire v1 and one main admin with a printed 16-character one-time password, `must_set_password`, expiry 72 h, audited actor "system"; a second run prints "Users already exist; nothing changed" and changes nothing (S-16, G-14)
  - [x] `reissue --email` works only for users still `must_set_password`; `recover --email --no-admin-can-sign-in` works only for an existing main admin and refuses without the flag; both audited actor "system", passwords never in the audit
  - [x] Playwright globalSetup creates a fresh PGlite data dir, migrates and runs `init` before `next dev` starts; `tests/support/e2e.ts` gives specs the admin's one-time password and helpers that create branches and users through RPC (no seed file)
- Result: 3/3 goals · coverage 90.54% · review 1 major (e2e lockout, fixed) + 8 minor; m1-m3, m7 fixed on owner request · ≈$2.12 · tester 44% · reviewer 18% · backend-coder 13% · debugger 9% · rework-tests 9% · harness-config 4% · rework-backend 3%

### T-02b · Staff sign-in, set password and sign-out on the server
- Owner: backend-coder, frontend-coder
- Depends on: T-19
- Files: src/server/auth/password.ts, src/server/auth/session.ts, scripts/admin.ts, src/server/repos/auth.ts, src/server/rpc/auth.ts, src/data/access/repos/auth.ts, src/proxy.ts, src/components/shared/RoleGuard.tsx, src/features/auth/**, src/app/sign-in/**, src/app/set-password/**, src/lib/signInUrl.ts, tests/support/e2e.ts, tests/unit/server/auth/**, tests/e2e/foundation/shell.spec.ts, tests/e2e/sign-in/sign-in.spec.ts, tests/unit/auth/routes.test.ts, tests/unit/server/rpc/handler.test.ts, tests/unit/switch/demoRemoved.test.tsx, tests/e2e/auth/**
- Context: SPEC US-01, US-23 (first sign-in), F-1, §5 F-1 and F-9 rows · LLD-phase2 §18.1, §18.3 (steps 3–7), §18.5, §17.3 (UNAUTHENTICATED handling) · files: src/server/auth/session.ts, src/server/auth/cookies.ts, src/features/auth/*
- Why separate: every later slice signs in through it.
- Status: Done
- Acceptance criteria:
  - [x] The first admin signs in with the one-time password → "Set your password" (≥ 8, not common, confirm) → `/admin`; support → `/support`; wrong password or unknown email → "Email or password is incorrect" (equal timing via `DUMMY_HASH`); deactivated user or branch → "Account disabled, contact admin"; a one-time password older than 72 h → "This one-time password has expired. Ask for a new one." (S-16, G-14, G-01)
  - [x] Passwords are stored only as argon2id hashes; "Sign out" in the support top bar and the admin menu deletes the session on the server; the sign-in screen shows "Forgot your password? Ask your admin to reset it." (S-18, G-2, G-13, G-W1)
  - [x] Without a cookie `/admin/*`, `/support/*` and `/account` redirect to `/sign-in?next=`; after the session ends the next action shows "Your session has ended. Sign in again." and returns to the same page after sign-in; a support session on `/admin` gets "You don't have access to this page" (AC-6; owner kept this wording 2026-11-23)
  - [x] Audit `auth.sign_in`; no password or token in the audit or the logs
- Result: 4/4 goals (support-user + deactivated-branch paths unit-tested only until T-21/T-10b) · unit 330, e2e 31, coverage 91.63% · review 0 major, 7 minor; 1, 3, 4 fixed on owner request · ≈$2.74 · tester 32% · backend-coder 20% · debugger 12% · frontend-coder 9% · implement-e2e-support 8% · reviewer 8% · rework-backend 6% · rework-tests 6%

### T-20 · Sign-in lockout, step-up password, My account
- Owner: backend-coder, frontend-coder
- Depends on: T-02b
- Files: src/server/auth/stepUp.ts, src/server/repos/auth.ts, src/server/rpc/auth.ts, src/data/access/repos/auth.ts, src/features/account/**, src/app/account/**, tests/unit/server/auth-limits/**, tests/e2e/account/**
- Context: SPEC US-01 (lockout), US-28, F-1 step 4, F-6 (5 wrong step-ups) · LLD-phase2 §18.3 (steps 1–2), §18.4, §17.2 (§7 AuthRepo row) · files: src/server/auth/*, src/server/repos/auth.ts
- Why separate: lockout and step-up are shared by responses and erasure; kept apart from sign-in to stay one session.
- Status: Done
- Acceptance criteria:
  - [x] The 6th wrong password for one email within 15 min → "Too many attempts. Try again in 15 minutes.", `auth.lockout` audited once; 30 failures from one address in 15 min → limited; an admin reset clears the email's lock (S-27, G-13)
  - [x] `verifyStepUp`: wrong → "Password incorrect"; 5 wrong in 15 min end that user's sessions
  - [x] My account shows name, email, role and branch; Change password: wrong current → "Password incorrect", a weak new one is rejected, success ends my other sessions and is audited `user.change_password` (US-28)
- Result: 3/3 in code (lock clear on admin reset → T-10b; step-up wired by T-08b/T-25) · unit 351, e2e 37, coverage 92.05% · review 1 major (parallel caps, fixed) + 4 minor · ≈$1.48 · tester 31% · debugger 22% · backend-coder 20% · reviewer 16% · frontend-coder 11%

### T-21 · Branches and advisors
- Owner: backend-coder, frontend-coder
- Depends on: T-02b
- Files: vitest.config.ts, tests/unit/server/db/client.test.ts, tests/unit/server/rpc/phase2Stubs.test.ts, src/features/admin-overview/AdminOverviewScreen.tsx, tests/support/e2e.ts, src/server/repos/branches.ts, src/server/repos/advisors.ts, src/server/rpc/branches.ts, src/server/rpc/advisors.ts, src/data/access/repos/branches.ts, src/data/access/repos/advisors.ts, src/features/admin-branches/**, src/app/admin/branches/**, src/app/admin/advisors/**, src/features/admin-overview/FirstRun*.tsx, tests/unit/server/branches/**, tests/e2e/admin-branches/**
- Context: SPEC US-23 (empty states), US-24, US-25, F-9 steps 2–3, §5 F-9 rows · LLD-phase2 §19, §23 (BranchRepo, AdvisorRepo) · files: src/server/scope.ts, src/server/audit.ts, src/components/shared/*
- Why separate: own routes and repos; the branch is the scope key and users and job cards need branches and advisors.
- Status: Done
- Acceptance criteria:
  - [x] Fresh system: `/admin` shows "Add your first branch" → `/admin/branches` → add "Velachery" and "Chennai"; a duplicate name → "A branch with this name already exists"; rename; deactivate / reactivate, never delete; each audited (US-23, US-24)
  - [x] Branch page: add advisor "Suresh", rename, deactivate / reactivate; branch admins manage only their branch at `/admin/advisors`; support can list only their branch's active advisors (US-25)
  - [x] Deactivating a branch ends its staff's sessions and blocks their sign-in ("Account disabled, contact admin"); branch screens are main-admin only (others see "Not allowed")
- Result: 2/3 ✅ + 1 ⚠️ (branch-admin/support views unit-tested until T-10b) · unit 366, e2e 45, coverage 92.9% · review 0 major, 4 minor · global vitest timeout 30 s · ≈$2.36 · frontend-coder 50% · tester 22% · backend-coder 17% · reviewer 6% · fix-flaky-db-test 2% · test-timeout-config 2%

### T-10b · Staff accounts: add, edit, move, deactivate, reset password
- Owner: backend-coder, frontend-coder
- Depends on: T-21
- Files: src/server/repos/users.ts, src/server/repos/userRules.ts, src/server/rpc/users.ts, src/data/access/repos/users.ts, src/features/admin-users/**, src/app/admin/users/**, tests/unit/server/users/**, tests/e2e/admin-users/**, tests/support/e2e.ts, tests/e2e/admin-branches/**, tests/e2e/account/**, tests/unit/admin-overview/firstRunCard.test.tsx
- Context: SPEC US-20, US-27, F-7, §5 F-7 and F-1 rows · LLD-phase2 §23 (UserRepo, `assertCanManage`), §18.2 (End) · files: src/server/auth/session.ts, src/features/admin-users/*
- Why separate: own route and repo; needs branches.
- Status: Done
- Acceptance criteria:
  - [x] The Velachery admin adds `arun@chandrahonda.in`: the role picker offers only Support and the branch is fixed; the main admin adds any role and branch; no branches yet → "Add a branch first"; duplicate → "Email already in use"; the new user's first sign-in forces "Set your password" (S-15, G-01, G-05)
  - [x] The main admin changes Arun's email and role → saved, Arun's sessions end, audit old → new (S-20, G-9); a branch admin can edit only name and email of their own support users; nobody changes their own role, branch or active flag; the last active main admin can't be deactivated or demoted
  - [x] Reset password while Priya is signed in → her next action goes to sign-in, the temp password → "Set your password", her lock is cleared, audit without the password (US-27, S-18, S-27); deactivate ends sessions at once
  - [x] A branch admin opening another branch's user → "Not found"; support → FORBIDDEN (US-29, S-19, G-W2)
- Result: 4/4 goals ✅ · last-admin race fixed with row lock + tests · e2e order fix · check.sh ✅ (61 e2e, cov 93.99%) · ≈$4.54 · tester 42% · frontend-coder 17% · backend-coder 16% · reviewer 8% · debugger 7% · rework 10%

### T-05b · Preview deploy on a new Vercel project
- Owner: devops
- Depends on: T-02b, T-10b
- Files: vercel.json, docs/DEPLOY.md
- Context: SPEC §8 Hosting, §9 Security · HLD Free now / paid later, Risks · LLD-phase2 §15.5, §16.2, §26 · files: .env.example, package.json
- Why separate: owner's accounts; the M3 risk checkpoint (first real host + real database; argon2 on Vercel unverified).
- Status: Done
- Acceptance criteria:
  - [x] **Owner step:** the owner creates a NEW Vercel project (not `chandra-psf`) from the repo and sets the Preview env (Neon `dev` pooled + unpooled URLs, `IP_HASH_PEPPER`, `CRON_SECRET`, `APP_URL`, public placeholders); the team never sees secrets; production deploys stay off until T-28 (`git.deploymentEnabled` for main = false) (G-04)
  - [x] The build runs `pnpm db:migrate && next build` against Neon `dev`; **owner step:** the maintainer runs `pnpm admin init` against `dev` from their laptop
  - [x] On the preview over HTTPS: the first admin signs in → sets a password → adds a branch and a support user who signs in (360 px captures in `.results/T-05b/`); argon2 hash time measured on Vercel (p95 logged; under 100 ms → parameters raised per LLD §18.1)
  - [x] `robots` noindex, security headers present, an unknown path → the not-found page with no stack trace (G-W7); `docs/DEPLOY.md` has the new-project and Neon setup steps
- Result: 4/4 goals ✅ (⚠️ no CSP → T-31s; argon2 under 100 ms → T-33s) · preview chandra-psf-preview (sin1) · sign-in p95 4.5 s → 0.27 s after region fix · ≈$1.41 · tester 57% · docs 25% · devops 12% · reviewer 5%

### T-31s · Content-Security-Policy header (shared-change)
- Owner: frontend-coder
- Depends on: T-05b
- Files: next.config.ts, src/proxy.ts, src/app/layout.tsx, src/config/env.ts, tests/e2e/foundation/**
- Context: SPEC §9 (Security & privacy) · LLD-phase2 §16.2, §26 · T-05b verify-preview report (no CSP header on the preview) · files: next.config.ts, src/proxy.ts, src/app/layout.tsx, /AGENTS.md + node_modules/next/dist/docs/ (CSP guide)
- Why separate: owner follow-up from T-05b (2026-11-24); next.config.ts and src/proxy.ts are frozen shared files.
- Status: Done
- Acceptance criteria:
  - [ ] Every HTML response carries a Content-Security-Policy that allows only the app's own origin for scripts, styles, images, fonts and connections, plus `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, `object-src 'none'` (nonce-based scripts if Next 16 supports it without breaking static pages; otherwise documented why not)
  - [ ] No CSP violations in the browser console across sign-in, admin pages, support pages and the customer feedback form (e2e asserts the header and no `securitypolicyviolation` events)
  - [ ] Dev mode (`pnpm dev`) still works (HMR allowed in development only)
- Result: 3/3 goals ✅ · nonce + strict-dynamic CSP in src/proxy.ts; all pages render per request (D-31) · 2 debugger rounds (Radix scroll-lock style nonce; e2e RPC budget) · Opus review 0/0/4 minor · ≈$3.76 · tester 38% · debugger 35% · reviewer 15% · frontend-coder 12%

### T-32 · Lists refresh right after Add branch / Add user
- Owner: frontend-coder
- Depends on: T-05b, T-34s
- Files: src/features/admin-users/**, src/features/admin-branches/**, src/app/admin/users/**, src/app/admin/branches/**, tests/e2e/admin-users/**, tests/e2e/admin-branches/**
- Context: T-05b verify-preview report (on the real host the new row shows only after a reload; local e2e passes) · LLD-phase2 §23 · files: src/features/admin-users/*, src/features/admin-branches/*
- Why separate: owner follow-up from T-05b (2026-11-24); likely a cache or revalidation difference on Vercel vs local.
- Status: Done
- Acceptance criteria:
  - [ ] After Add branch, Add user, Edit user and Deactivate, the list shows the change without a reload, both locally and on the preview deploy
  - [ ] An e2e test fails on the old behaviour (no reload between add and assert, no stale cache)
- Result: 2/2 goals ✅ (owner to confirm on the preview after deploy) · saved row merged into cached list, then refetch · review 0/0/2 minor · batch-approved · post-sync e2e flake fixed by T-34s (D-32) · ≈$1.33 · frontend-coder 50% · tester 42% · reviewer 7%

### T-34s · Signed-in staff skip the anonymous flood limit (shared-change)
- Owner: backend-coder
- Depends on: T-05b
- Files: src/server/rpc/handler.ts, src/server/rpc/context.ts, tests/unit/server/rpc/**
- Context: D-32 · T-32 debug report (.results/T-32/debug-1-debugger.md in the T-32 worktree: the 300/h per-IP public flood limit runs out late in a full e2e run, a refused currentUser shows "Your session has ended") · LLD-phase2 rate limits · files: src/server/rateLimit.ts, src/server/rpc/handler.ts
- Why separate: owner decision D-32 (2026-11-24); security behaviour change, own card; unblocks T-32's merge.
- Status: Done
- Acceptance criteria:
  - [ ] A request with a valid staff session is not counted against or refused by the anonymous per-IP flood limit; requests with no session or an invalid/expired one are limited exactly as before (unit tests for both, incl. 301st anonymous request refused)
  - [ ] The per-email sign-in lockout and any per-user limits are unchanged; a forged or expired session cookie does not bypass the flood limit
  - [ ] Full scripts/check.sh passes twice in a row (the T-32 admin-users "own row" e2e no longer hits RATE_LIMITED)
- Result: 3/3 goals ✅ · valid staff session skips the anonymous per-IP flood limit; no/forged/expired session limited as before · Opus review 0/0/0 · ≈$0.40 · tester 44% · backend-coder 32% · reviewer 24%

### T-33s · Raise argon2 parameters (LLD §18.1 trigger) (shared-change)
- Owner: backend-coder
- Depends on: T-05b
- Files: src/server/auth/password.ts, src/server/auth/**, src/server/repos/auth.ts, src/server/env.ts, scripts/admin.ts, tests/unit/server/auth/**, tests/e2e/auth/auth.spec.ts, tests/support/e2e.ts
- Context: LLD-phase2 §18.1 · T-05b retime report (.results/T-05b/argon2-timing-sin1.txt: real-hash minus one-query baseline ≈ 21–38 ms on Vercel sin1) · files: src/server/auth/*
- Why separate: T-05b criterion "under 100 ms → parameters raised per LLD §18.1"; src/server/auth/** is frozen.
- Status: Done
- Acceptance criteria:
  - [ ] argon2 parameters raised per LLD §18.1 so the hash takes ≥100 ms on Vercel sin1 (measured with a server-side timing log, not network round-trips), p95 sign-in still under 1 s
  - [ ] Existing hashes still verify and are re-hashed with the new parameters on the next successful sign-in (if LLD §18.1 says so)
- Result: 1.5/2 goals ✅ (⚠️ ≥100 ms hash + p95 <1 s on Vercel sin1 to be measured by the owner with AUTH_HASH_TIMING=1) · t 2→8, guarded re-hash on sign-in · Opus review 0/0 after 1 Major fixed · ≈$1.35 · tester 60% · backend-coder 22% · reviewer 18%

## M4 · Support → customer loop across devices

### T-03b · Support: find a job card or type in a new one
- Owner: backend-coder, frontend-coder
- Depends on: T-02b, T-21
- Files: src/server/repos/jobCards.ts, src/server/rpc/jobCards.ts, src/data/access/repos/jobCards.ts, src/features/support/**, src/app/support/new/**, tests/unit/server/jobCards/**, tests/e2e/support-jobcards/**, src/server/repos/jobCardRules.ts
- Context: SPEC US-02, US-26, F-2 steps 1–4, §5 F-2 rows · LLD-phase2 §22 · files: src/domain/jobCardInput.ts, src/domain/models.ts, src/domain/jobCard.ts, src/domain/phone.ts, src/features/support/*
- Why separate: own repo (personal data, branch scope); links (T-03c) need a saved job card.
- Status: Done
- Acceptance criteria:
  - [x] SPEC §5 row Ramesh Kumar · 98400 12345 · tn09bx4521 · Activa 6G · Paid service · 14 Nov 2026 · Suresh → details card "+91 98400 12345 · TN 09 BX 4521 · Scooter · Advisor: Suresh"; ` jc241042` finds it (S-02); not found → "No job card JC-24-1042 at this branch yet" + New job card with the number prefilled
  - [x] Tambaram support looking up Velachery's `JC-24-1042` → not found (US-29); a duplicate at the same branch → "JC-24-1042 already exists at this branch" + Open it; a retry with the same request id after a lost reply → the saved card (S-29, G-15)
  - [x] No advisors → "Ask your admin to add advisors for this branch"; a future date → "Service date can't be in the future"; editing phone or details is audited `jobcard.update` old → new and blocked with "Feedback already received" after completion (S-03, G-05)
  - [x] A failed save keeps the form and shows "Couldn't save, try again" (S-13)
- Result: approved 2026-11-24 · 4/4 goals (completed-visit block + audit unit-tested until T-03c) · 1 major fixed in review · 8 minors · ≈$3.92

### T-03c · Support: generate and send a link, My links / All branch links
- Owner: backend-coder, frontend-coder
- Depends on: T-03b
- Files: src/server/tokens.ts, src/server/repos/visits.ts, src/server/rpc/visits.ts, src/data/access/repos/visits.ts, src/features/support/**, src/app/support/**, tests/unit/server/visits/**, tests/e2e/support-links/**, src/server/repos/jobCards.ts, src/server/repos/visitRows.ts, tests/unit/minors/minorsFrontend.test.tsx, tests/unit/support/linkActions.test.tsx
- Context: SPEC US-03, US-04, US-05, F-2 steps 5–7, §5 F-2 WhatsApp row · LLD-phase2 §21 (LinkIssued, VisitRepo list and create, tokens) · files: src/domain/whatsapp.ts, src/features/support/*
- Why separate: own repo (link secrecy); the customer form needs issued links.
- Status: Done
- Acceptance criteria:
  - [x] Generate → `/f/<43-char code>` shown once with Send on WhatsApp (the exact SPEC §5 `wa.me` URL with `APP_URL`) and Copy link ("Copied"); the database holds only the SHA-256; status Created, expires in 7 days (AC-2, D-11, S-01)
  - [x] Leaving and reopening the job card shows the link's status but no link and no Copy (G-1, S-17); a current link offers Resend / Regenerate, no duplicate; Completed → "Feedback already received"
  - [x] `/support` shows My links by default and an All branch links toggle with created-by, search by job card / reg. no, no answers or ratings; empty → "No feedback links yet. Tap New feedback link to start."; a user moved to Tambaram sees only Tambaram's links (G-8, S-19)
  - [x] No mobile number → Send disabled with "Enter a mobile number to send on WhatsApp", Copy works (S-03)
- Result: approved 2026-11-24 · 4/4 goals · rework per owner (erased-customer check on Resend/Regenerate; any branch support user may act, D-35) · ≈$2.38

### T-03d · Support: resend, regenerate and cancel any branch link
- Owner: backend-coder, frontend-coder
- Depends on: T-03c
- Files: src/server/repos/visits.ts, src/server/rpc/visits.ts, src/features/support/**, tests/unit/server/visits-actions/**, tests/e2e/support-link-actions/**
- Context: SPEC US-06, F-2 step 7, §5 F-2 Resend rows · LLD-phase2 §21 (resend, regenerate, cancel) · files: src/server/tokens.ts, src/features/support/*
- Why separate: second half of the link repo; runs beside the customer form slice.
- Status: Done
- Acceptance criteria:
  - [x] A link of 15 Nov resent on 18 Nov → new code, WhatsApp opens with it, Copy offered, still expires 22 Nov; the 15 Nov code shows "A newer link was sent to you on WhatsApp"; audit `link.resend` (G-1, S-17)
  - [x] Arun resends a link Priya made, from All branch links → audit actor Arun (G-8); Regenerate → a new 7-day visit and the old link shows the newer-link page (S-05); Cancel (confirm) → Cancelled, the link shows "Link not valid", audit `link.cancel` (S-14)
  - [x] Resend on an expired link → CONFLICT (use Regenerate); any action on a completed, cancelled or replaced link → "This link can no longer be changed"; another branch's visit id → NOT_FOUND (US-29); a failed save shows "Couldn't save, try again" (S-13)
- Result: approved 2026-11-24 · 3/3 goals · resend/regenerate/cancel UI for any branch link, double-tap guard · review 0 major after rework, 2 minor · 16 unit + 9 e2e tests (3 fixme until T-04b's customer pages) · also Windows EPERM fix in e2e lock helpers

### T-04b · Customer form on any phone, privacy notice and `/privacy`
- Owner: backend-coder, frontend-coder
- Depends on: T-03c
- Files: src/server/repos/feedback.ts, src/server/rpc/feedback.ts, src/data/access/repos/feedback.ts, src/features/feedback-form/**, src/app/f/**, src/features/privacy/**, src/app/privacy/**, tests/unit/server/feedback/**, tests/e2e/feedback-form/**
- Context: SPEC US-07 to US-12, F-3, §9 Privacy notice, §5 F-3 rows · LLD-phase2 §21 (getVisitByToken, markOpened, submitResponse), LLD §9 (draft) · files: src/domain/alertRules.ts, src/domain/answers.ts, src/domain/visibility.ts, src/server/tokens.ts, src/server/rateLimit.ts
- Why separate: the public flow with its own repo (abuse, personal data); no staff screens.
- Status: Done
- Acceptance criteria:
  - [x] The welcome shows the greeting, "Takes about 2 minutes", the SPEC §9 notice with placeholder company and phone, 3 years, providers possibly outside India, and "How we use your answers" → `/privacy` (S-26, G-12); fetching the page without running its script does not set Opened, a real browser does (US-07, AC-3)
  - [x] Submit with Q12 = 1, Q15 = Yes → thank-you "Our team will call you soon"; the server stores one response and the alert "Callback requested · Q12 rated 1" for the visit's branch; hidden follow-ups and text over 1,000 characters are rejected by the server; `<script>` text is shown as plain text (AC-7, US-11, G-05, G-W3)
  - [x] Two contexts submit the same link → one response, the other sees "Thank you — already submitted"; a same-phone retry with the same submission id → the normal thank-you with the callback line (S-29, G-15); expired, replaced, cancelled and erased links → their pages (AC-5, S-05, S-14)
  - [x] 45 submits of different links from one address in an hour are all accepted; the 6th submit on one link in an hour → "Too many requests, try again in a few minutes" (S-22, G-7); a failed submit keeps every answer and Retry succeeds (S-13)
- Result: approved 2026-11-24 · 4/4 goals (hidden follow-ups dropped, D-36) · welcome + §9 notice, /privacy, submit + alert, link-state pages, rate limits · review 0 major, 10 minor · cov 95.5% · sync flake = CPU load in older admin specs (debugger)

### T-22s · Expose POLL_SECONDS as a public setting (shared-change)
- Owner: frontend-coder
- Depends on: —
- Files: src/config/env.ts, .env.example, tests/unit/foundation/config.test.ts
- Context: LLD-phase2 §15.5, §20 · files: src/config/env.ts, .env.example, tests/unit/foundation/config.test.ts
- Why separate: src/config/env.ts and .env.example are frozen; T-22 needs the poll interval from config (NEEDS FILE from T-22).
- Status: Done
- Acceptance criteria:
  - [x] `src/config/env.ts` exports the poll interval from `NEXT_PUBLIC_POLL_SECONDS`, default 30, invalid/≤0 values fall back to 30
  - [x] `.env.example` lists `NEXT_PUBLIC_POLL_SECONDS=` with a one-line comment; the foundation config test still passes (updated only for the new key)
- Result: approved 2026-11-24 · 2/2 goals · NEXT_PUBLIC_POLL_SECONDS (default 30) · ≈$0.24

### T-22s2 · Make src/config/env.ts zod-free for client pages (shared-change)
- Owner: frontend-coder
- Depends on: T-22s
- Files: src/config/env.ts, tests/unit/foundation/config.test.ts
- Context: LLD-phase2 §15.5, §18.5 (CSP), §20 · files: src/config/env.ts, tests/unit/foundation/config.test.ts, tests/e2e/foundation/csp.spec.ts
- Why separate: env.ts is frozen; T-22's providers.tsx imports POLL_SECONDS on every page and zod's Function("") probe breaks the strict CSP (owner decision D-34).
- Status: Done
- Acceptance criteria:
  - [x] src/config/env.ts has no zod import; NEXT_PUBLIC_DEALER_PHONE keeps its behaviour (dev fallback outside production; missing/empty in production → throws with a clear message); POLL_SECONDS unchanged (default 30); still the only client process.env reader
  - [x] Foundation config tests pass (updated only where they asserted zod specifics); scripts/check.sh passes on its own branch
- Result: approved 2026-11-24 · 2/2 goals · env.ts zod-free (D-34) · ≈$0.52

### T-22 · Live refresh only while staff use the screen
- Owner: frontend-coder
- Depends on: T-01b
- Files: src/data/remote/activity.ts, src/data/remote/poller.ts, src/app/providers.tsx, tests/unit/remote/poller/**
- Context: SPEC US-05, §4 Rules (Shared data on every device), DoD G-6 item · LLD-phase2 §20 · files: src/data/remote/*
- Why separate: client-only refresh engine with no repo (free-plan budget).
- Status: Done
- Acceptance criteria:
  - [x] A visible tab used in the last 15 min → all staff topics refresh every `POLL_SECONDS`; hidden, or idle > 15 min → no requests (fake timers, request counter) (S-23, G-6)
  - [x] Returning to the tab, or the first input after idle → one refresh at once; `x-psf-active: 1` only within 60 s of input
  - [x] No polling on `/f/*`, `/privacy`, `/sign-in` or without a staff session; the form query never refetches
- Result: approved 2026-11-24 · 3/3 goals · polling only while a staff tab is visible and used in the last 15 min · review 0 major, 4 minor (details were in the git-ignored card on the old machine) · ≈$1.25

### T-07b · Alerts queue on the server, by branch
- Owner: backend-coder, frontend-coder
- Depends on: T-04b
- Files: src/server/repos/alerts.ts, src/server/rpc/alerts.ts, src/data/access/repos/alerts.ts, src/features/admin-alerts/**, src/app/admin/alerts/**, tests/unit/server/alerts/**, tests/e2e/admin-alerts/**
- Context: SPEC US-12, US-13, F-4, §5 F-4 row · LLD-phase2 §17.2 (§11 row), §19 · files: src/domain/alertRules.ts, src/features/admin-alerts/*
- Why separate: own repo and route.
- Status: Done
- Acceptance criteria:
  - [x] The Velachery admin sees only Velachery alerts and badge count; the main admin sees all with a Branch filter and a branch column (US-13, S-30)
  - [x] Priya S. → Contacted with note "Called, bike rechecked 22 Nov" → amber row, audit `alert.status` + note (AC-8); a stale version → "Someone else changed this alert. Reload to see the latest." and the typed note is kept (S-13)
  - [x] Another branch's alert id → "Not found"; support → FORBIDDEN (US-29, AC-6, G-W2); alerts of deleted responses are hidden; an erased customer shows "Erased customer"
- Result: approved 2026-11-24 · 3/3 goals · branch-scoped alerts + badge, main-admin Branch filter (card label), atomic version check, audit alert.status/alert.note · review 3 major → fixed + re-reviewed · 14 unit + 10 e2e · cov 96.2% · audit asserted at unit level until T-09b

### T-23 · Wire-up: support → customer loop across devices on the preview
- Owner: devops
- Depends on: T-03d, T-04b, T-22, T-07b, T-05b
- Files: tests/e2e/preview/**
- Context: SPEC DoD items 3–6, §5 F-3 rows · HLD Live refresh · files: docs/DEPLOY.md
- Why separate: the M4 risk checkpoint on the real host + Neon; no feature edits (fixes raise `Needs file:` on the owning slice).
- Status: Backlog
- Acceptance criteria:
  - [ ] On the preview: a support laptop generates a link; a different phone (360 px) opens it → the laptop shows Opened within 30 s, then Completed after submit, with no reload (DoD 5, US-05, S-12)
  - [ ] Q15 = Yes creates the alert for that branch; Velachery's admin sees it, Tambaram's does not (S-30)
  - [ ] A laptop tab left idle 15+ min makes no requests (Vercel / Neon logs or a network capture) and refreshes at once on return (G-6, S-23); captures in `.results/T-23/`
- Result: —

### T-35 · Cloud sessions + preview workflow — DROPPED 2026-11-24 (owner: not needed; moving accounts instead)

## M5 · Admin console, privacy, clean-up, go-live readiness

### T-36 · Contact details from env keys (D-37)
- Owner: frontend-coder
- Depends on: —
- Files: src/config/env.ts, src/features/feedback-form/contact.ts, src/features/privacy/contact.ts, src/features/feedback-form/PrivacyNotice.tsx, src/features/privacy/**, tests/unit/foundation/**
- Context: LLD-phase2 §15.5 · SPEC §9 · D-37
- Why separate: small config wiring; removes the duplicated constants from T-04b.
- Status: Backlog
- Acceptance criteria:
  - [ ] The welcome notice and /privacy show NEXT_PUBLIC_COMPANY_NAME, _PRIVACY_PHONE and _PRIVACY_EMAIL from src/config/env.ts (one shared source, no duplicated constants); .env.example keeps the keys with placeholders
  - [ ] Missing keys fall back to the placeholders outside production; the go-live check still flags placeholders
- Result: —

### T-06b · Overview analytics on the server, with the branch filter
- Owner: backend-coder, frontend-coder
- Depends on: T-04b, T-21
- Files: src/server/repos/analytics.ts, src/server/rpc/analytics.ts, src/data/access/repos/analytics.ts, src/features/admin-overview/**, src/app/admin/page.tsx, tests/unit/server/analytics/**, tests/e2e/admin-overview/**
- Context: SPEC US-14 to US-16, F-5, §5 F-5 rows · LLD-phase2 §17.2 (§10 row), §19 · files: src/domain/metrics/*, src/features/admin-overview/*
- Why separate: own repo and route (scope leaks in numbers).
- Status: Backlog
- Acceptance criteria:
  - [ ] Velachery 40 visits / 30 completed and Tambaram 10 / 5 → the Velachery admin sees 75 %, the main admin "All branches" 70 % and "Tambaram" 50 % (S-30); the Branch filter is shown only to main admins; the advisor list follows the branch
  - [ ] Launch day (no responses) → every block "—" / "No responses for these filters", no arrows (S-10); Open alerts excludes alerts of deleted responses (T-06r regression, S-09); all blocks filter on the service date (S-11)
  - [ ] Support → FORBIDDEN from `getAnalytics` (403 in logs) and "Not allowed" on `/admin` (AC-6, G-W2); anonymised responses are still counted
- Result: —

### T-08b · Responses on the server: browse, edit, delete, restore
- Owner: backend-coder, frontend-coder
- Depends on: T-04b, T-20
- Files: src/server/repos/responses.ts, src/server/rpc/responses.ts, src/data/access/repos/responses.ts, src/features/admin-responses/**, src/app/admin/responses/**, tests/unit/server/responses/**, tests/e2e/admin-responses/**
- Context: SPEC US-17, US-18, US-21, F-6, F-4 step 4, §5 F-6 rows · LLD-phase2 §17.2 (§12 row), §18.4 · files: src/domain/alertRules.ts, src/domain/visibility.ts, src/server/auth/stepUp.ts
- Why separate: own repo and routes (data changes behind step-up).
- Status: Backlog
- Acceptance criteria:
  - [ ] Edit Q6 2 → 4 with the right password (checked on the server) → Q6a removed, audit old `{Q6:2,Q6a:{options:["Rude"]}}` new `{Q6:4}`; wrong → "Password incorrect" and nothing saved; a stale version → "Someone else changed this. Reload to see the latest." (AC-9, G-01)
  - [ ] Edit Q12 1 → 4 on an only-reason alert → Resolved "Auto-resolved: no alert reason after edit"; Q15 No → Yes → a new Open alert (S-08)
  - [ ] Delete on 1 Dec 2026 → Recently deleted shows "Removed for good on 31 Dec 2026"; Restore brings the answers and the alert back; both audited (US-21, S-09, G-03)
  - [ ] The Tambaram admin opening a Velachery response URL → "Not found", no data (US-29); a failed edit keeps the edited answers and shows "Couldn't save, try again" (S-13)
- Result: —

### T-09b · Audit log on the server: scoped, branch column, paging
- Owner: backend-coder, frontend-coder
- Depends on: T-02b
- Files: src/server/repos/audit.ts, src/server/rpc/audit.ts, src/data/access/repos/audit.ts, src/features/admin-audit/**, src/app/admin/audit/**, tests/unit/server/audit/**, tests/e2e/admin-audit/**
- Context: SPEC US-19, F-6 step 5 · LLD-phase2 §17.2 (§13 row), §16.1 (audit_log) · files: src/features/admin-audit/*
- Why separate: own read-only repo and route.
- Status: In progress
- Acceptance criteria:
  - [ ] A branch admin sees only their branch's entries, the main admin all with a Branch filter; columns time (IST), actor, branch, action, entity, old → new; system entries show "System"
  - [ ] 100 per page with "Load more" (cursor); action filter; no edit or delete controls and no write method in the RPC table
  - [ ] Support → FORBIDDEN (G-W2)
- Result: —

### T-24 · Privacy requests: find a customer across branches and download
- Owner: backend-coder, frontend-coder
- Depends on: T-03b
- Files: src/server/repos/customers.ts, src/server/rpc/customers.ts, src/server/csv.ts, src/data/access/repos/customers.ts, src/features/admin-customers/**, src/app/admin/customers/**, tests/unit/server/customers/**, tests/e2e/admin-customers/**
- Context: SPEC US-30, F-10 steps 1–3, §5 F-10 rows · LLD-phase2 §24 (CustomerRepo, CSV) · files: src/features/admin-customers/*
- Why separate: own repo and route (personal data export); erase (T-25) builds on its screen.
- Status: Backlog
- Acceptance criteria:
  - [ ] The main admin searches `98400 12345` → two rows (Ramesh Kumar · Velachery · 14 Nov 2026; Lakshmi Kumar · Tambaram · 2 Dec 2026), none ticked; no match → "No customer found with that number" (S-21)
  - [ ] Download with only Ramesh ticked → a CSV (UTF-8 BOM) of that job card's link and answers only; a value starting `=` is prefixed with `'`; audit `customer.export {count}` without personal values
  - [ ] Nothing ticked → Download disabled; branch admin and support → "Not allowed" / FORBIDDEN (G-4, G-W2)
- Result: —

### T-25 · Erase a customer's personal data (and re-apply after restore)
- Owner: backend-coder, frontend-coder
- Depends on: T-24, T-20
- Files: src/server/erasure.ts, src/server/repos/customers.ts, src/server/rpc/customers.ts, src/features/admin-customers/**, scripts/admin.ts (reapply-erasures command), tests/unit/server/erasure/**, tests/e2e/admin-customers-erase/**
- Context: SPEC US-30, F-10 step 4, US-32 (G-5), §5 F-10 rows · LLD-phase2 §24 (`eraseJobCards`), §26 (Restore) · files: src/domain/erasure.ts, src/server/auth/stepUp.ts · D-38: also align domain JobCard/Visit types with LLD §17.2 (erasedAt, nullable name/reg no)
- Why separate: the irreversible path gets its own tester + reviewer; the cron reuses `eraseJobCards`.
- Status: Backlog
- Acceptance criteria:
  - [ ] Ramesh ticked → confirm ("This can't be undone", 1 row) + password → "Erased customer"; phone, reg. no and Q14 gone (incl. Recently deleted and audit old/new → "[erased]"); Lakshmi untouched; Overview counts unchanged; his open link → "Link not valid"; audit `customer.erase {count}` (S-21)
  - [ ] Erasure writes `erasure_journal` and one log event with job card ids only, no personal data (G-5)
  - [ ] `admin reapply-erasures --from <url>` re-erases journal ids newer than a restore point; running it twice changes nothing (S-24)
- Result: —

### T-26 · Daily clean-up: retention, purge, expired sessions
- Owner: backend-coder
- Depends on: T-25, T-05b
- Files: src/app/api/cron/daily/**, src/server/jobs/cleanup.ts, vercel.json, tests/unit/server/cleanup/**
- Context: SPEC US-31, US-21 (30 days), F-10 step 5, §5 F-10 retention rows · LLD-phase2 §25 · files: src/server/erasure.ts, src/domain/retention.ts
- Why separate: own route and job (automatic deletion).
- Status: Backlog
- Acceptance criteria:
  - [ ] `GET /api/cron/daily` without the right `Bearer CRON_SECRET` → 401 (constant-time compare); `vercel.json` schedule `30 21 * * *`
  - [ ] Clock at 12 Feb 2027: the unanswered visit served 14 Nov 2026 is erased; the answered one is untouched until 14 Nov 2029; a response deleted 1 Dec 2026 is purged on 31 Dec with `response.purge` (no answers) (US-31)
  - [ ] Expired sessions and attempts / limits older than 24 h removed (G-11); one `system.cleanup` audit with counts; a second run the same day changes nothing; batches stop at 240 s and the next run continues
- Result: —

### T-27 · Wire-up: branch isolation check across every server method
- Owner: tester
- Depends on: T-03d, T-04b, T-06b, T-07b, T-08b, T-09b, T-10b, T-20, T-21, T-25
- Files: tests/unit/server/scope-matrix/**
- Context: SPEC US-29, §2 Role rules, DoD scope item · LLD-phase2 §19 table, §17.3 · files: src/server/rpc/*
- Why separate: one whole-app check that needs every repo; fixes raise `Needs file:` on the owning slice.
- Status: Backlog
- Acceptance criteria:
  - [ ] Every RPC method in the registry is called as support, as branch admin of the other branch and as main admin against a two-branch PGlite fixture; results match the LLD §19 table (out of scope → NOT_FOUND / FORBIDDEN, never partial data) (US-29, AC-6, G-W2)
  - [ ] A `branchId` argument from a branch user never widens their scope; a new RPC method without a matrix row fails the test
- Result: —

### T-11b · Wire-up: phase-2 Definition-of-done walkthrough on Postgres
- Owner: frontend-coder, tester
- Depends on: T-03d, T-04b, T-06b, T-07b, T-08b, T-09b, T-10b, T-20, T-21, T-22, T-25, T-26
- Files: tests/e2e/walkthrough/**
- Context: SPEC §12 (DoD), §5 · files: tests/support/*, docs/scenarios.md (S-16 to S-30)
- Why separate: the whole-app check; no feature edits (fixes raise `Needs file:` on the owning slice).
- Status: Backlog
- Acceptance criteria:
  - [ ] On a fresh PGlite server: init → the owner sets a password → "Add your first branch" → two branches, advisors, a branch admin and a support user each → each lands on their portal (DoD 1–2, S-16)
  - [ ] Two browser contexts: job card → link → customer form at 360 px with the notice → the laptop shows Opened then Completed without reload → alert → Contacted → Resolved, all in the audit (DoD 3–8, S-06, S-12)
  - [ ] Edit / delete / restore with the password; lockout + admin reset; erase one ticked customer; clean-up run by clock (DoD 11–14, S-09, S-21, S-27)
  - [ ] 360 px and 1440 px screenshots of every SPEC §7 screen in `.results/T-11b/`; an accessibility check (labelled inputs) passes (G-W5); no demo label, picker or Reset anywhere (DoD last item)
- Result: —

### T-28 · Production deploy on the new vercel.app address
- Owner: devops
- Depends on: T-26, T-05b
- Files: vercel.json, docs/DEPLOY.md
- Context: SPEC §8, §12 DoD (DEPLOY.md item), US-23, US-32 · HLD Free now / paid later · LLD-phase2 §15.5, §16.2, §25, §26 · files: .env.example
- Why separate: owner's accounts; the production database.
- Status: Backlog
- Acceptance criteria:
  - [ ] **Owner step:** Production env on the new project (Neon `main` URLs, its own `CRON_SECRET`, `IP_HASH_PEPPER`, `APP_URL` = the new `….vercel.app` address, public placeholders); production deploys switched on; the maintainer runs `admin init` against `main` → only questionnaire v1 + one main admin exist (DoD 1, G-04)
  - [ ] The cron is visible in Vercel and one run returns 200 with an audit `system.cleanup`
  - [ ] `docs/DEPLOY.md` holds setup, first admin, re-issue / recovery, the free → paid upgrade (plans + 7-day history setting), partial restore into a branch and full rollback with `reapply-erasures` (US-32, G-5, S-24, DoD 15)
- Result: —

### T-29 · Go-live gate checklist
- Owner: backend-coder, devops
- Depends on: T-28
- Files: scripts/golive-check.ts, docs/PRODUCTION.md, docs/DEPLOY.md (gate section), tests/unit/golive/**
- Context: SPEC §12.1, §9 Security · HLD Go-live gate · LLD-phase2 §26 (`golive-check`) · files: docs/PRODUCTION.md, .env.example
- Why separate: the gate the owner ticks before the first real customer link.
- Status: Backlog
- Acceptance criteria:
  - [ ] `pnpm golive:check` fails on any placeholder company name / phone / email / dealer phone, a non-production `APP_URL`, or a production database holding more than the questionnaire + main admins before launch, and passes when they're real (S-25)
  - [ ] `docs/PRODUCTION.md` phase-2 rows are each marked done with their task or `N/A (reason)`; an owner checklist for the six SPEC §12.1 items with plain steps (Vercel Pro, Neon paid + 7-day history, restore rehearsal, company details, legal check, demo project offline) (S-28)
- Result: —

### T-30 · Handover (CR-1)
- Owner: devops, backend-coder, frontend-coder, tester, architect, docs
- Depends on: T-29, T-11b, T-27, T-23
- Files: .github/workflows/ci.yml, README.md, OWNER.md, docs/** (as-built LLD and ARCHITECTURE and WALKTHROUGH; DEMO-GUIDE.md removed from main), src/** (known minors of 5 min or less), tests/**
- Context: stage 8 handover · STATE.md Known minors · batched review
- Why separate: final handover; folds in the T-12 README / demo-guide rework.
- Status: Backlog
- Acceptance criteria:
  - [ ] CI runs check.sh with PGlite (no external database) and passes on a fresh clone; the README covers `pnpm install`, local PGlite, `db:migrate`, `admin init`, `scripts/check.sh` (G-06)
  - [ ] As-built docs updated; OWNER.md explains roles, branches, resets, privacy requests and the go-live gate; known minors fixed or listed
- Result: —

