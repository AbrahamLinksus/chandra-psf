# DECISIONS — chandra-psf

## Tier 1 — decided by the owner
| ID | Date | Decision | Chosen | Means for you · if wrong | Alternatives | Task |
|---|---|---|---|---|---|---|
| D-01 | 2026-11-21 | Demo scope | Clickable UI on mock data, sign-in picker; real DB/auth in phase 2 | Data per-browser only · weeks to change | Real DB + login now | plan |
| D-02 | 2026-11-21 | Hosting | Public Vercel link, free tier | Needs owner's Vercel account | Local only | plan |
| D-03 | 2026-11-21 | Demo data persistence | Browser storage until "Reset demo data"; no backup | Clearing browser data loses changes | Wipe on reload; server | plan |
| D-04 | 2026-11-21 | Delete undo | "Recently deleted" list with restore | — | Permanent; no delete | plan |
| D-05 | 2026-11-21 | Seed dates | Shift relative to load/reset day | — | Fixed dates | plan |
| D-06 | 2026-11-21 | Multi-tab | Live sync, never overwrite | — | Refresh-to-see; single tab | plan |
| D-07 | 2026-11-21 | Alerts after edit | Re-run rules; auto-resolve with audit note | — | Never change; delete | plan |
| D-08 | 2026-11-21 | Smaller gaps G-4..G-15 | Critic option A each | Marked (assumed) in SPEC | B/C options | plan |
| D-09 | 2026-11-21 | Stack + toolkit | LLD §0.4 package table (16 items) | — | see LLD | plan |
| D-10 | 2026-11-21 | Data hooks | TanStack Query 5 | — | Hand-written hooks | plan |
| D-11 | 2026-11-21 | Demo link format | Visit details + random part (phase 2: random-only, hashed) | Links long, fictional data readable | Random-only now | plan |
| D-12 | 2026-11-21 | Team | frontend, backend, tester, reviewer, debugger, docs, devops; no optional agents | — | + data-cleaner | plan |
| D-13 | 2026-11-21 | Env install | Approved plan .results/env/plan.md: pnpm; TS 5.9.3, ESLint 9.39.5, Vitest 4.1.12, dep-cruiser 17.4.3 (newer majors break on node 25); + @testing-library/dom, @vitejs/plugin-react; gitleaks into .tools/; .githooks pre-commit; engines node>=24 | ~1h to bump later | newest majors | plan |
| D-14 | 2026-11-21 | Brand red accent | Shared-change task T-01s before round 3 | — | later; keep near-black | T-01s |
| D-15 | 2026-11-22 | Support on /admin URLs | Role guard redirects to /not-allowed ("You don't have access to this page"), no data | — | Render "Not allowed" in place on each admin page (frozen guard change) | T-06 |
| D-16 | 2026-11-22 | Q6a value in response.edit audit | Raw stored answer {options:[...]} | Less readable in audit log; format later | SPEC shorthand ["Rude"] | T-08 |
| D-17 | 2026-11-22 | Response rate after a delete | Deleted responses stop counting; rate updates (as built) | SPEC S-09 wording to fix at handover | Rate stays the same | T-11 |

## Tier 2 — decided by agents (overrule any time)
| ID | Date | Decision | Chosen | Agent | Task |
|---|---|---|---|---|---|
| A-01 | 2026-11-21 | Architect decisions (9) | see .results/plan/design-architect.md | architect | plan |
