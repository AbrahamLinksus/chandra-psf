# STATE — chandra-psf

> Source of truth for resuming. Updated after every task.

| Field | Value |
|---|---|
| Problem | Mobile-first post-service feedback (PSF) system for Chandra Honda: WhatsApp links → step form → admin analytics + alerts. Demo phase = clickable UI on mock data, built to become fully interactive later. |
| Repo | AbrahamLinksus/chandra-psf (public) |
| Local folder | C:/Users/Jake/chandraProject (Windows 11, Git Bash; worktrees in C:/Users/Jake/chandraProject-wt/; start sessions in C:/Users/Jake/chandraProject) |
| Status | In progress |
| Stage | 7 Build (phase 2) |
| Design | one design step (one Next.js app, no outside services) |
| Plugin | dev-team-setup 1.1.0 |
| Runners | on |
| Owner mode | developer |
| Size | large (phase 2) · signals: backend, auth, database, multi-user, deployment · 31 tasks |
| Milestone | M4 · Support → customer loop across devices (8/9 original + T-22s, T-22s2 done) |
| Next step | M4: T-07b (alerts queue by branch; deps done) → then T-23 wire-up on the preview → M4-docs. Un-fixme T-03d's 3 e2e tests (T-04b pages now on main) inside T-07b's or T-23's test step. Run full checks one at a time with NODE_OPTIONS=--max-old-space-size=4096. |
| Started | 2026-11-21 17:35 +05:30 · Budget 0 (no cap) |
| Approval mode | batch-low-risk |
| Cost mode | balanced |
| Visuals | installed (capture.py ready) |
| Last updated | 2026-11-24 (Windows resume) |

## Team
| Agent | Model | Why on this project |
|---|---|---|
| frontend-coder | Sonnet | all screens, shadcn/ui, Recharts |
| backend-coder | Sonnet | domain fns, data layer, store, seed script |
| tester | Sonnet | Vitest + Playwright (multi-tab, 360px) |
| reviewer | Opus (Sonnet low-risk, balanced) | read-only review |
| debugger | Opus (Sonnet low-risk, balanced) | failures |
| docs | Haiku | README, handover |
| devops | Sonnet | Vercel deploy |

## Open work
- Tasks in progress live on `wip/*` branches (see `taskgit.sh list`); their step states are in each branch's TASK_PROGRESS.md.

## Batch queue (low-risk cards waiting for the batch card)
- empty

## Open decisions (waiting for the owner)
- none

## How to run
```bash
pnpm install
git config core.hooksPath .githooks          # once per clone (pre-commit hook)
PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64 pnpm exec playwright install chromium   # Arch fallback
pnpm dev                                     # http://localhost:8000
CHECK_NO_COVERAGE=1 scripts/check.sh         # all quality gates
# gitleaks v8.30.1 lives at ~/.cache/chandra-psf/tools/gitleaks (shared by all worktrees; new machine: copy it there)
```

## Known minors
- Lockout counts failures per email for 15 min and a correct sign-in does not reset them — confirm against SPEC (≈5 min check)
| Task | Where | Fix | Size |
|---|---|---|---|
| T-15 | src/server/env.ts | drop runtime DATABASE_URL_UNPOOLED requirement (review m-8; src + test change) | ≈5 min |
| T-15 | review minors m-3, m-11, m-13, m-17 | optional/larger items in .results T-15 review (copied below at merge) | ≈10 min |
| T-15 | T-24/T-25 erasure | must use SET LOCAL for psf.redact on pooled connections (review m-2) | ≈2 min |
| T-15 | docs/LLD-phase2.md §16 | getDb returns Promise<Db>, LLD says Db (review m-4) | ≈2 min |
| T-18 | src/server/rpc clientIp | trusts first X-Forwarded-For entry; confirm Vercel overwrites XFF or use x-real-ip / request.ip | ≈5 min |
| T-18 | src/server/rpc auth.ts | signOut / signInAsDemo marked public vs LLD | ≈2 min |
| T-18 | src/server/rateLimit.ts | move flood constant (300/h) to src/domain/constants.ts | ≈2 min |
| T-18 | src/data/remote/rpcClient.ts kindOf | guesses read/write from method name; derive from the registry | ≈10 min |
| T-18 | src/server/rpc handleRpc | hard-wires its ctx; inject for testability | ≈5 min |
| T-18 | eslint.config.mjs (gate, env-setup) | server-package import ban skips .js/.mjs | ≈2 min |
| T-10b | src/features/account/* (360 px) | long email overflows My account sideways on the support page | ≈3 min |
| T-10b | src/server/repos/users.ts move audit | a branch move is audited only under the new branch | ≈3 min |
| T-10b | last-admin FOR UPDATE lock | untested under real concurrency (PGlite serialises); verify once on Neon dev with the T-19 lock | ≈5 min |
| T-10b | branch picker cache fix | debugger fix for "Add a branch first" shown wrongly not re-reviewed; include in M3 batched review | ≈5 min |
| T-21 | src/server/repos/advisors.ts | imports isUniqueViolation from the branches repo; move to a shared db helper | ≈3 min |
| T-21 | src/server/repos/branches.ts updateBranch | empty patch calls .set({}); return early | ≈2 min |
| T-21 | branch deactivation | ends sessions one user at a time (N+1); one delete by branch | ≈5 min |
| T-21 | FirstRunCard | fetches branches for every role; only for main admins | ≈2 min |
| T-21 | vitest.config.ts (gate) | 28-core machine runs ~28 PGlite workers at once; if timeouts return, cap maxWorkers 4–8 | ≈2 min |
| T-20 | src/server/repos/users.ts (T-10b) | Reset password must call clearSignInFailures(tx, email) so an admin reset clears the lock (DoD) | ≈3 min |
| T-20 | src/server/repos/auth.ts parallel-caps fix | debugger fix (slot reserved under advisory lock) not re-reviewed; include in M3 batched review | ≈5 min |
| T-20 | src/features/account ChangePasswordForm | Retry button resends the wrong password; clear the field on WRONG_PASSWORD | ≈3 min |
| T-20 | src/server/auth/attempts.ts (new) | move clearSignInFailures out of repos | ≈5 min |
| T-20 | email normalisation | normalised in 3 places; use one emailKey helper | ≈3 min |
| T-10b | src/server/repos/users.ts:272 applyUpdate | overlapping edits can undo each other (set from a snapshot read outside the tx); write only changed fields (M3 review m1) | ≈5 min |
| T-10b | src/features/admin-users/pickerConfig.ts:44 | listBranches error shows "Add a branch first"; show a load error instead (m2) | ≈3 min |
| T-10b | tests (branch picker) | no regression test that useBranchOptions(false) never writes ["branches","list"] (m3) | ≈10 min |
| T-20 | tests/e2e/account/account.spec.ts:74 | wrong-current-password e2e uses the shared admin; 5 step-up failures end its sessions → flake; use a throwaway user (m4) | ≈5 min |
| T-20 | src/server/repos/auth.ts:243 doChangePassword | doesn't refuse users still on a one-time password (m5) | ≈2 min |
| T-20/T-10b | stepUp.ts, userRules.ts, scripts/admin.ts | lockout/OTP constants duplicated; move to src/domain/constants.ts (m6) | ≈3 min |
| T-20 | src/features/account/AccountDetails.tsx:3 | ROLE_LABELS duplicates admin-users/userForm.ts (m7) | ≈2 min |
| T-19 | tests/support/e2e.ts:108-128 | stale-OTP retry loop can lock the shared admin if marker write fails (m8) | ≈3 min |
| T-21 | src/server/repos/advisors.ts | writes audit `advisor.rename`; AuditAction/auditFormat only know `advisor.update` (M3 as-built) | ≈3 min |
| M3-docs | README.md env section | lists NEXT_PUBLIC_COMPANY_NAME / PRIVACY_PHONE / PRIVACY_EMAIL / POLL_SECONDS, which no code reads; drop or mark future | ≈2 min |
| T-22s | src/config/env.ts:21 | DEFAULT_POLL_SECONDS belongs in src/domain/constants.ts | ≈2 min |
| T-22s | src/config/env.ts:26 | accepts fractional poll seconds (0.01); require integer ≥ 1 | ≈2 min |
| T-22s2 | docs/CONVENTIONS.md §1 l.14, §5 l.50 | still say config env uses zod; reword (D-34) | ≈2 min |
| T-03b | src/server/repos/jobCards.ts:123, 259-262 | "Feedback already received" check runs outside the update tx; move it inside (review #5) | ≈5 min |
| T-03b | src/server/repos/jobCards.ts:139 / jobCardRules.ts inputOf | merge re-validates every stored field; legacy null name/reg no blocks edits (review #2) | ≈3 min |
| T-03b | tests/unit/server/jobCards/jobCardRepo.test.ts:216 | new test doesn't assert the jobcard.update audit row | ≈1 min |
| T-03b | src/server/repos/jobCardRules.ts:1 | missing `import "server-only"` | ≈1 min |
| T-03b | src/server/repos/jobCards.ts:~86 getJobCard | main admin: limit(1) picks an arbitrary branch when numbers collide | ≈3 min |
| T-03b | src/features/support/JobCardForm.tsx msgFor | VALIDATION on an unrendered field shows nowhere; fall back to SaveState | ≈3 min |
| T-03b | src/features/support/useJobCardForm.ts:81 | unused `today`; use as date max or drop | ≈1 min |
| T-03b | src/features/support/FoundCardSection.tsx | takes whole hook return; NO_ADVISORS / "Feedback already received" copy duplicated client+server | ≈4 min |
| T-10b | src/features/admin-users/UserRow.tsx:24,26 | long emails overflow at 360 px: min-w-0 on grid span, break-all on email | ≈2 min |
| T-03c | src/features/support/LinkActions.tsx:142 | expired/no-phone link: no button shown and Resend disabled though the URL could be copied | ≈3 min |
| T-20 | tests/e2e/account change-password success | test.fixme until T-10b can create a throwaway user | ≈5 min |
| T-02b | src/components/shared/RoleGuard.tsx m6 | usePathname drops the query string, so next= loses it on mid-page session end; add useSearchParams | ≈3 min |
| T-02b | src/server/auth/password.ts m7 | no import "server-only" (tsx scripts import it); record the exemption | ≈1 min |
| T-19 | scripts/admin.ts m4 | validate --name / --email with zod (CONVENTIONS §1) | ≈3 min |
| T-19 | scripts/admin.ts + scripts/migrate.ts m5 | extract shared scripts/lib/openDb.ts (PGlite/Neon opening duplicated) | ≈5 min |
| T-19 | scripts/admin.ts m6 | use pathToFileURL(process.argv[1]).href | ≈1 min |
| T-19 | playwright.config.ts m8 (gate, env-setup) | reuseExistingServer: false + comment on real start order (webServer before globalSetup; safe only while DB opens lazily) | ≈2 min |
| T-19 | scripts/admin.ts m1 lock | advisory lock untested under real concurrency (PGlite serialises); verify once on Neon dev | ≈5 min |
| T-19 | tests/support/e2e.ts M1 fix | debugger fix for admin lockout (once-per-run OTP switch via marker/lock files) was not re-reviewed; include in M3 batched review | ≈5 min |
| T-01b | SupportShell import order, UserRow roleLabel wrapper | tidy | ≈1 min |
| T-01b | src/data/access/repos/jobCards.ts, src/server/rpc/jobCards.ts (T-03b) | remove unused listFreshJobCards from repo interface + rpc | ≈3 min |
| T-01b | src/server/env.ts APP_URL | kept on purpose (production https check); README/docs still mention DEMO_PASSWORD, NEXT_PUBLIC_APP_URL, exceljs → M3 docs pass | ≈5 min |
| T-17 | src/server/{ctx,scope,audit}.ts, auth/{session,cookies}.ts | add `import "server-only"` (CONVENTIONS §2) or an exemption comment like log.ts | ≈2 min |
| T-16 | docs/LLD-phase2.md §25 | retention cut-off says `<`; code + SPEC use inclusive `<=` (12 Feb 2027 example) | ≈1 min |
| T-16 | src/domain/commonPasswords.ts | ~900 hand-built entries, not a real top-1000 list | ≈5 min |
| T-31s | src/app/layout.tsx nonce script | beforeInteractive nonce script may be blocked under strict-dynamic on Safari/Firefox; check on the preview | ≈5 min |
| T-31s | src/proxy.ts dev CSP | dev connect-src `ws: wss:` allows any host; limit to localhost | ≈2 min |
| T-31s | src/proxy.ts buildCsp | move buildCsp + sonner style hashes to src/config/csp.ts; re-derive hashes on any sonner upgrade | ≈5 min |
| T-31s | nonce-script comment | wording | ≈1 min |
| T-31s | e2e RPC budget | full e2e suite uses ~286 of the 300/h public-RPC limit; any new spec may trip it (raise limit in test env or share sessions) | ≈10 min |
| T-31s | currentUser errors | any error incl. RATE_LIMITED shows "Your session has ended" (product wording) | ≈5 min |
| T-31s | e2e suite | 136 skipped tests per run; confirm they are all intended test.fixme specs | ≈5 min |
| T-33s | .env.example + LLD-phase2 §15.5 | AUTH_HASH_TIMING missing; add the LLD row first (config.test.ts reads it), then .env.example → M3 docs pass | ≈3 min |
| T-33s | tests/support/e2e.ts | RATE_LIMITED-only retry for shared-admin sign-in under parallel workers; watch for masking real lockout regressions | ≈2 min |
| T-32 | src/features/admin-*/use{Branch,User}List.ts | use the exported list-key constants (review minor) | ≈2 min |
| T-32 | useRefreshingMutation.ts / useUsersMutation.ts | near-duplicate hooks; merge (optional) | ≈10 min |
| T-32 | tests/e2e/admin-users/sharedAdmin.ts | one shared admin session per run to stay under the 5-per-email sign-in limit; little headroom left → flake risk | ≈5 min |
| T-32 | tests/unit/server/{auth-limits/parallelLimits,auth/signInTransaction}.test.ts | two unused eslint-disable warnings | ≈1 min |
| Windows | scripts/check.sh (gate, env-setup) | set the Ubuntu Playwright override only when `uname -s` is Linux | ≈2 min |
| T-03d | src/components/shared/ConfirmDialog.tsx | add a confirmDisabled prop so Cancel's confirm button is disabled while saving (ref guard already blocks a 2nd request) | ≈3 min |
| T-03d | src/components/shared/SaveState.tsx | add canRetry prop; drop the ActionStatus wrapper in LinkActions.tsx:51-61 | ≈5 min |
| T-03d | src/features/support/useLinkActions.ts:80-81 | move reset() inside the try block (tidy) | ≈1 min |
| T-03d | tests/e2e/admin-users uniq() | Date.now() names collide under --repeat-each (NAME_IN_USE); fix must keep names short (360 px row) | ≈5 min |
| T-03d | tests/e2e/support-link-actions | 3 test.fixme need T-04b customer pages (newer link, Link not valid); un-fixme after T-04b | ≈5 min |
| Windows | vitest | V8 out-of-memory in a worker on this machine; run check.sh with NODE_OPTIONS=--max-old-space-size=4096 | ≈0 |
| T-04b | src/data/access/repos/feedback.ts submitFeedback | submissionId optional only for old tests; make it required (LLD §17.2) | ≈3 min |
| T-04b | src/features/{feedback-form,privacy}/contact.ts + PrivacyNotice | duplicated (depcruise bans feature→feature); move to a shared module | ≈5 min |
| T-04b | src/server/repos/feedback.ts | openedAt can be overwritten by a racing markOpened; small race windows vs erasure/Resend during submit | ≈5 min |
| T-04b | src/server/repos/feedback.ts rate limits | local limit constants → src/domain/constants.ts; hitLinkLimit duplicates hitIpLimit | ≈5 min |
| T-04b | src/features/feedback-form draft id | crypto.randomUUID has no fallback (old browsers / http) | ≈2 min |
| T-04b | src/domain/answers.ts (validation) | duplicate multi-select options are not rejected | ≈2 min |
| T-04b | review | 10 minors total; the rest were in the git-ignored review report that approve deleted (Windows) | — |
| T-04b debug | playwright.config.ts (gate) | `workers: Number(process.env.E2E_WORKERS ?? 8)` to stop CPU starvation in the first wave | ≈2 min |
| T-04b debug | tests/e2e admin-users.spec.ts:85, admin-branches.spec.ts:39-41 | test.slow() on s15; call listBranches before the 5 s waitFor (keep-alive ECONNRESET) | ≈3 min |

## Owner actions (outside the repo)
- Neon: project chandra-psf (Singapore) done; branches `production` (= LLD "main") and `dev`; compute 0.25 CU. Docs/tasks saying Neon `main` mean `production`.
- Set the real dealer phone on Vercel (NEXT_PUBLIC_DEALER_PHONE, Production + Preview) and redeploy — see docs/DEPLOY.md.
- T-33s (D-30): after the next preview deploy, set AUTH_HASH_TIMING=1 on Vercel Preview, sign in ~20×, check the log: hash ≥100 ms and p95 sign-in <1 s; then unset it. Below 100 ms or p95 ≥1 s → retune task.
- Redeploy to Vercel to publish M2 (the live site is still the T-05 build).

## Context additions
<!-- note: planner assigned docs/** files to devops in some tasks; devops scope excludes docs/** — route those edits to the docs agent -->
| Role | Also read | Why (from gap report) |
|---|---|---|
| frontend-coder, backend-coder | <wt>/AGENTS.md + node_modules/next/dist/docs/ (relevant guide) | Next 16.4 has breaking API changes vs training data |
| architect | <plugin root>/.devteam default scopes.json | needed to decide whether to override scopes |
| docs | <wt>/src/config/env.ts + full STATE.md | README env keys and run steps (M3 gap) |
| reviewer (server/public tasks) | src/domain/visibility.ts, src/server/rpc/schemas.ts, src/server/rpc/args.ts, src/server/db/schema/responses.ts, src/components/shared/SaveState.tsx | verify validation and unique constraints (T-04b gap) |
| debugger, tester (e2e) | tests/e2e/admin-users/sharedAdmin.ts, tests/e2e/support-links/helpers.ts, playwright.config.ts | shared e2e lock/session helpers (T-03d gap) |
| task-runner, devops | (rule) | the hook blocks git push, gh and vercel for agents: the Orchestrator pushes wip/* and checks Vercel builds, then resumes the runner |

## Notes for the next session
- 2026-11-24 Windows lessons: (1) if the pre-commit hook blocks a checkpoint, the next agent's `taskgit scope` reverts the previous agent's uncommitted files — get each step committed (fix lint first) before the next agent runs; never run scope while two agents' work is uncommitted. (2) `taskgit approve` deletes the worktree incl. .results (cards/reports gone) and leaves locked node_modules/.next folders in C:/Users/Jake/chandraProject-wt/<id> — copy anything needed before approving; delete leftovers when no server runs. (3) Agents can't set PORT; the Orchestrator runs sync/approve with PORT, PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=win64 and NODE_OPTIONS=--max-old-space-size=4096.
- RESUMED 2026-11-24 on Windows 11 (Git Bash, not WSL; owner's choice). Setup: pnpm 11.24.0 via npm -g, gitleaks.exe 8.30.1 in ~/.cache/chandra-psf/tools/, ~/bin/python3 shim → Anaconda python (the WindowsApps python3 is a Store stub; taskgit scope + the scope-guard hook need python3). main 40d207c made the spawned-CLI tests Windows-safe. check.sh still defaults PLAYWRIGHT_HOST_PLATFORM_OVERRIDE to ubuntu24.04-x64, so on Windows run it with `export PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=win64` (agents may need the Orchestrator to run it). T-04b/T-03d merged main with TASKGIT_SKIP_CHECK=1 so their testers get both fixes.
- PAUSED 2026-11-24 14:48 +05:30. Owner switching OS (Linux → Windows); resume on the new machine with `/setup-project resume chandra-psf`. M4: done T-03b, T-03c, T-22s, T-22s2 (+ M3 approved). Open wip branches (all pushed):
  - wip/T-22 — TASK READY, sync ✅ (PORT=8022), card in Batch queue; only the approve is left (Windows: re-run sync first, worktree is new).
  - wip/T-04b — backend-coder stopped mid-implement; partial files checkpointed (src/server/repos/feedback.ts, src/server/rpc/feedback.ts, src/data/access/repos/feedback.ts, NEW src/server/repos/linkAccess.ts — not in Files; add it or have the coder fold it in). Restart a fresh runner `Resume at: implement`, tell the backend-coder to inspect the partial files first.
  - wip/T-03d — backend-coder found no gaps (T-03c met every server criterion); restart at the frontend-coder step, then test+review. Customer newer-link/"Link not valid" pages may need T-04b's src/app/f/**.
  - Runners can't set PORT (their Bash blocks env prefixes): tell them not to sync; the Orchestrator runs `PORT=<port> taskgit sync/approve`.
  - New machine (Windows) setup: taskgit.sh, check.sh and .githooks are bash — run Claude Code in WSL2 (recommended) or Git Bash; clone into the WSL filesystem, not /mnt/c (PGlite + Playwright are slow there). Then `pnpm install`, `git config core.hooksPath .githooks`, `pnpm exec playwright install chromium` (no Arch override needed on Ubuntu/WSL), gitleaks v8.30.1 to ~/.cache/chandra-psf/tools/gitleaks. .results/ is git-ignored, so old cards/screens stay on the Linux machine; the Batch queue line above has what T-22's card needs.
- 2026-11-24 M3 approved (37a3695). Lessons: never run two agent steps in one worktree at once (except tester+reviewer): `step done` for one reverted the other's files. STATE.md edits only on main (taskgit reverts them in task branches). Owner granted architect write on docs/LLD-phase2.md (.devteam/scopes.json). README run order (db:migrate → admin init) verified on scratch PGlite. approve/sync need PORT set to avoid 8000 collisions (runners can't set it: their Bash blocks env prefixes, so the Orchestrator runs sync with PORT when a runner reports BLOCKED on e2e timeouts).
- PAUSED 2026-11-23 14:39 +05:30. Phase 2 M3: 11/13 done (T-13..T-21, T-01b, T-02b, T-19, T-20, T-21 approved). In flight: T-10b (wip/T-10b) — owner approved "fix last-admin race, then approve"; race fixed + tests done; sync failed on the order-dependent T-21 first-run e2e. The debugger's fix was REVERTED by the scope check (e2e files are tester-owned, not debugger). Restart a fresh tester step `fix-e2e-order` (brief: apply .results/T-10b/debug-sync-debugger.md fix + FirstRunCard unit test, check.sh twice), then `taskgit sync` (PORT=8010), record + approve with no new card. Then T-05b.
- Lesson: route e2e/test fixes to the tester, not the debugger (debugger scope excludes tests/e2e and tests/support). Owner meeting brief published: https://claude.ai/artifact/X52xXkAVNinb4uaW5XuhfY (meeting/psf-owner-brief.html outside the repo).
- PAUSED 2026-11-22 21:08 +05:30. Phase 2 (CR-1) build: M3 4/13 done (T-13, T-14, T-15, T-16). In flight: T-17 (wip/T-17) — runner stopped during implement; restart with a fresh runner `Resume at: implement` and tell the backend-coder to inspect partial files first. Batch queue empty. Owner Neon setup done (branches production + dev, 0.25 CU). Role limits learned: tests → tester, gate files → env-setup, docs/** → docs, .env* → Orchestrator with owner OK.
- Owner's input spec is saved verbatim in docs/SPEC-input.md. Owner wants a dummy/clickable UI first, architected so it can be made "very interactive" later.

- PAUSED 2026-11-21 22:08 +05:30. Both open tasks are mid-rework, branches checkpointed (wip/T-03, wip/T-04).
  - T-03 rework (owner-approved): WhatsApp green token + icon, hide actions on another user's link (VisitSummary.isMine — backend DONE), truncate long URL, minors ≤5 min. Resume at `rework-frontend` (frontend-coder was stopped mid-step; check partial files), then test+review (Sonnet reviewer, rework diff only), sync. T-03 Files temporarily include src/app/globals.css and src/data/access/repos/visits.ts.
  - T-04 rework (owner-approved): red progress/selected states, expired-mid-form → Expired page, close animation, grapheme-safe 1,000-char cut. Backend, frontend and debug rounds DONE. Resume at `test+review`: tester fixes 3 stale unit tests + adds regression tests; reviewer (Sonnet) on rework diff; sync; retake screenshots after animations settle.
  - After both: M1 left = T-05 Vercel preview (owner must sign in to Vercel + link). T-06 (M2) waits until M1 ends.
  - Cost tool (cost.py) reports $0 — costs shown as "not measured".
  - 2026-11-22: T-03 and T-04 approved. Plugin quirk: `taskgit step done` scope check reverts files merged in from main (fixed by hand with `git checkout main -- <files>`); after any catchup/merge, diff the worktree against main before approving.
  - Live demo: https://chandra-psf.vercel.app (Vercel project abrahamlinksus-projects/chandra-psf; linked from the T-05 worktree, re-link from main with `vercel link --yes --project chandra-psf` for redeploys). APP_URL unset on purpose.
  - T-08 must pass the new 4th argument `meId` to `toVisitSummary` (from M1 LLD sync).
  - Handover: fix SPEC S-09 wording ("rate still reads 75%") to match D-17; seed has no CUST-014 / "Priya S." alert (walkthrough uses r-s005 Kavitha P).
  - Batch queue: empty. Known plugin quirks: guard splits Files on commas (no {a,b} or commas in parens); guard sometimes blocks harmless shell commands; check.sh needs PORT per task to avoid port 8000 collisions.
