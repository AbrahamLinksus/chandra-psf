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
| Milestone | M1 · Support → customer loop (1/5 tasks) |
| Next step | T-02 · sign-in, seed, reset |
| Started | 2026-11-21 17:35 +05:30 · Budget 0 (no cap) |
| Approval mode | batch-low-risk |
| Cost mode | balanced |
| Visuals | installed (capture.py ready) |
| Last updated | 2026-11-21 20:35 +05:30 |

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
| T-01 | docs/LLD.md (store.ts `read`) | LLD doc drift | ≈2 min |
| T-01 | scripts/check.sh, playwright.config.ts | review minor #9 (gate files) | ≈3 min |
| T-01 | src/hooks/useFiltersFromUrl.ts dateOf | regex accepts impossible dates (2026-13-45) | ≈2 min |
| T-01 | src/data/local/repos/token.ts isPayload | Date.parse accepts loose formats | ≈2 min |
| T-01 | spec F-4 | reconcileAlert on resolved alert w/o reasons now returns "none" — confirm in T-07 | ≈0 min (decision) |

## Context additions
| Role | Also read | Why (from gap report) |
|---|---|---|
| frontend-coder, backend-coder | <wt>/AGENTS.md + node_modules/next/dist/docs/ (relevant guide) | Next 16.4 has breaking API changes vs training data |
| architect | <plugin root>/.devteam default scopes.json | needed to decide whether to override scopes |

## Notes for the next session
- Owner's input spec is saved verbatim in docs/SPEC-input.md. Owner wants a dummy/clickable UI first, architected so it can be made "very interactive" later.
