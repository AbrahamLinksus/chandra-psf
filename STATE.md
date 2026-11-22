# STATE — chandra-psf

> Source of truth for resuming. Updated after every task.

| Field | Value |
|---|---|
| Problem | Mobile-first post-service feedback (PSF) system for Chandra Honda: WhatsApp links → step form → admin analytics + alerts. Demo phase = clickable UI on mock data, built to become fully interactive later. |
| Repo | AbrahamLinksus/chandra-psf (public) |
| Local folder | /home/Jake/learning/chandraProject/chandra-psf (worktrees in /home/Jake/learning/chandraProject/chandra-psf-wt/; start sessions in /home/Jake/learning/chandraProject) |
| Status | Active |
| Stage | 7 Build |
| Design | one design step (one Next.js app, no outside services) |
| Plugin | dev-team-setup 1.1.0 |
| Runners | on |
| Owner mode | developer |
| Size | medium · signals: deployment (public Vercel) · 22 stories |
| Milestone | M2 · Admin console (M1 approved 2026-11-22; T-12 in progress) |
| Next step | Run M2 tasks from `taskgraph --ready`; T-12 running |
| Started | 2026-11-21 17:35 +05:30 · Budget 0 (no cap) |
| Approval mode | batch-low-risk |
| Cost mode | balanced |
| Visuals | installed (capture.py ready) |
| Last updated | 2026-11-22 10:44 +05:30 |

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
| T-02 | src/features/auth hooks | ['session'] query key hard-coded (use shared key) | ≈3 min |
| T-02 | auth redirect | admin with mustSetPassword goes to /support after set-password | ≈3 min |
| T-02 | src/data/local/repos/auth.ts | branch coverage 78.6% | ≈10 min |
| T-01 | docs/LLD.md (store.ts `read`) | LLD doc drift | ≈2 min |
| T-01 | scripts/check.sh, playwright.config.ts | review minor #9 (gate files) | ≈3 min |
| T-01 | src/hooks/useFiltersFromUrl.ts dateOf | regex accepts impossible dates (2026-13-45) | ≈2 min |
| T-01 | src/data/local/repos/token.ts isPayload | Date.parse accepts loose formats | ≈2 min |
| T-04 | src/features/feedback-form TextField | Intl.Segmenter built at module load, no fallback (old browsers) | ≈5 min |
| T-04 | feedback-form Reveal | focus lost when follow-up collapses; stays mounted 300 ms under reduced motion | ≈10 min |
| T-03 | src/features/support NewLinkScreen | list item may widen at 360 px | ≈2 min |
| T-03 | src/features/support copy flash | timeout not cleared on unmount | ≈3 min |
| T-03 | support link card | "sent by another team member" wording not from SPEC (owner approved as-is) | ≈1 min |
| T-03 | src/features/support | NEEDS_MOBILE constant in a component file | ≈2 min |
| T-03 | tests/unit/support | no test for job-card re-lookup after Cancel | ≈5 min |
| T-05 | Vercel env | NEXT_PUBLIC_DEALER_PHONE is a placeholder (+91 44 0000 0000); set the real number + redeploy | ≈2 min (owner) |
| M1 | src/data/access/repos/feedback.ts (frozen) | interface comment omits CONFLICT (expired) outcome the UI relies on | ≈2 min |
| M1 | docs/LLD.md | 432 lines vs 400 cap | ≈10 min |
| T-12 | src/config/env.ts | `pnpm dev` fails without .env (README says cp .env.example .env); add dev fallback like check.sh | ≈5 min |
| T-06 | src/features/admin-overview advisor table | last column cut off at 360 px (owner saw it) | ≈5 min |
| T-06 | admin-overview category scores | "74 / 100" label wraps at 360 px | ≈3 min |
| T-01 | spec F-4 | reconcileAlert on resolved alert w/o reasons now returns "none" — confirm in T-07 | ≈0 min (decision) |

## Context additions
| Role | Also read | Why (from gap report) |
|---|---|---|
| frontend-coder, backend-coder | <wt>/AGENTS.md + node_modules/next/dist/docs/ (relevant guide) | Next 16.4 has breaking API changes vs training data |
| architect | <plugin root>/.devteam default scopes.json | needed to decide whether to override scopes |

## Notes for the next session
- Owner's input spec is saved verbatim in docs/SPEC-input.md. Owner wants a dummy/clickable UI first, architected so it can be made "very interactive" later.

- PAUSED 2026-11-21 22:08 +05:30. Both open tasks are mid-rework, branches checkpointed (wip/T-03, wip/T-04).
  - T-03 rework (owner-approved): WhatsApp green token + icon, hide actions on another user's link (VisitSummary.isMine — backend DONE), truncate long URL, minors ≤5 min. Resume at `rework-frontend` (frontend-coder was stopped mid-step; check partial files), then test+review (Sonnet reviewer, rework diff only), sync. T-03 Files temporarily include src/app/globals.css and src/data/access/repos/visits.ts.
  - T-04 rework (owner-approved): red progress/selected states, expired-mid-form → Expired page, close animation, grapheme-safe 1,000-char cut. Backend, frontend and debug rounds DONE. Resume at `test+review`: tester fixes 3 stale unit tests + adds regression tests; reviewer (Sonnet) on rework diff; sync; retake screenshots after animations settle.
  - After both: M1 left = T-05 Vercel preview (owner must sign in to Vercel + link). T-06 (M2) waits until M1 ends.
  - Cost tool (cost.py) reports $0 — costs shown as "not measured".
  - 2026-11-22: T-03 and T-04 approved. Plugin quirk: `taskgit step done` scope check reverts files merged in from main (fixed by hand with `git checkout main -- <files>`); after any catchup/merge, diff the worktree against main before approving.
  - Live demo: https://chandra-psf.vercel.app (Vercel project abrahamlinksus-projects/chandra-psf; linked from the T-05 worktree, re-link from main with `vercel link --yes --project chandra-psf` for redeploys). APP_URL unset on purpose.
  - T-08 must pass the new 4th argument `meId` to `toVisitSummary` (from M1 LLD sync).
  - Batch queue: empty. Known plugin quirks: guard splits Files on commas (no {a,b} or commas in parens); guard sometimes blocks harmless shell commands; check.sh needs PORT per task to avoid port 8000 collisions.
