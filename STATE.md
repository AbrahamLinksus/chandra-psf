# STATE — chandra-psf

> Source of truth for resuming. Updated after every task.

| Field | Value |
|---|---|
| Problem | Mobile-first post-service feedback (PSF) system for Chandra Honda: WhatsApp links → step form → admin analytics + alerts. Demo phase = clickable UI on mock data, built to become fully interactive later. |
| Repo | AbrahamLinksus/chandra-psf (public) |
| Local folder | /home/Jake/learning/chandraProject/chandra-psf (worktrees in /home/Jake/learning/chandraProject/chandra-psf-wt/; start sessions in /home/Jake/learning/chandraProject) |
| Status | Active |
| Stage | 7 Build (phase 2) |
| Design | one design step (one Next.js app, no outside services) |
| Plugin | dev-team-setup 1.1.0 |
| Runners | on |
| Owner mode | developer |
| Size | large (phase 2) · signals: backend, auth, database, multi-user, deployment · 31 tasks |
| Milestone | M3 · Empty system you can sign into, on a preview deploy (6/13) |
| Next step | Run T-01b (switch app to the server; also wire onUnauthenticated + ErrorCode gaps) and whatever --ready prints |
| Started | 2026-11-21 17:35 +05:30 · Budget 0 (no cap) |
| Approval mode | batch-low-risk |
| Cost mode | balanced |
| Visuals | installed (capture.py ready) |
| Last updated | 2026-11-23 07:31 +05:30 |

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
| Task | Where | Fix | Size |
|---|---|---|---|
| T-15 | src/server/env.ts | drop runtime DATABASE_URL_UNPOOLED requirement (review m-8; src + test change) | ≈5 min |
| T-15 | review minors m-3, m-11, m-13, m-17 | optional/larger items in .results T-15 review (copied below at merge) | ≈10 min |
| T-15 | next.config.ts (frozen) | add @electric-sql/pglite to serverExternalPackages (review m-6) — do in T-01b, which first runs PGlite inside Next | ≈2 min |
| T-15 | T-24/T-25 erasure | must use SET LOCAL for psf.redact on pooled connections (review m-2) | ≈2 min |
| T-15 | docs/LLD-phase2.md §16 | getDb returns Promise<Db>, LLD says Db (review m-4) | ≈2 min |
| T-18 | src/app/providers.tsx (T-01b) | wire rpcClient onUnauthenticated to invalidate the session query | ≈5 min |
| T-18 | src/server/rpc clientIp | trusts first X-Forwarded-For entry; confirm Vercel overwrites XFF or use x-real-ip / request.ip | ≈5 min |
| T-18 | src/server/rpc auth.ts | signOut / signInAsDemo marked public vs LLD | ≈2 min |
| T-18 | src/server/rateLimit.ts | move flood constant (300/h) to src/domain/constants.ts | ≈2 min |
| T-18 | src/data/remote/rpcClient.ts kindOf | guesses read/write from method name; derive from the registry | ≈10 min |
| T-18 | src/server/rpc handleRpc | hard-wires its ctx; inject for testability | ≈5 min |
| T-18 | eslint.config.mjs (gate, env-setup) | server-package import ban skips .js/.mjs | ≈2 min |
| T-18 | src/data/access/result.ts (T-01b) | add RATE_LIMITED, OTP_EXPIRED, NAME_IN_USE to ErrorCode and switch the T-18 plain-JSON replies to them (§17.2) | ≈5 min |
| T-17 | src/server/{ctx,scope,audit}.ts, auth/{session,cookies}.ts | add `import "server-only"` (CONVENTIONS §2) or an exemption comment like log.ts | ≈2 min |
| T-16 | docs/LLD-phase2.md §25 | retention cut-off says `<`; code + SPEC use inclusive `<=` (12 Feb 2027 example) | ≈1 min |
| T-16 | src/domain/commonPasswords.ts | ~900 hand-built entries, not a real top-1000 list | ≈5 min |
| T-16 | src/domain/types.ts Role | switch phase-1 Role to StaffRole (T-01b/T-17) | ≈5 min |

## Owner actions (outside the repo)
- Neon: project chandra-psf (Singapore) done; branches `production` (= LLD "main") and `dev`; compute 0.25 CU. Docs/tasks saying Neon `main` mean `production`.
- Set the real dealer phone on Vercel (NEXT_PUBLIC_DEALER_PHONE, Production + Preview) and redeploy — see docs/DEPLOY.md.
- Redeploy to Vercel to publish M2 (the live site is still the T-05 build).

## Context additions
<!-- note: planner assigned docs/** files to devops in some tasks; devops scope excludes docs/** — route those edits to the docs agent -->
| Role | Also read | Why (from gap report) |
|---|---|---|
| frontend-coder, backend-coder | <wt>/AGENTS.md + node_modules/next/dist/docs/ (relevant guide) | Next 16.4 has breaking API changes vs training data |
| architect | <plugin root>/.devteam default scopes.json | needed to decide whether to override scopes |

## Notes for the next session
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
