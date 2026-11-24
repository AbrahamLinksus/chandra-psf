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
| D-18 | 2026-11-22 | Production gate G-W1 (session expiry, argon2id) | Waived for the phase-1 demo | Sessions never expire; hashing runs in the browser; sample data only — must be built server-side before real customer data (phase 2) | Build session expiry now | handover |
| D-19 | 2026-11-22 | Known minor "T-01 review #9 (gate files)" | Waived | Details unrecoverable; CI and fresh-clone runs pass | Devops re-review | handover |

| D-20 | 2026-11-22 | CR-1 Production phase 2 | Server + Neon Postgres + own DB-session sign-in; 31 tasks in M3–M5 | ≈$70–100 build | Stay a demo | CR-1 |
| D-21 | 2026-11-22 | Phase-2 inputs | Job cards typed in by support; click-to-send WhatsApp; several branches; start empty | — | DMS/upload; WhatsApp API | CR-1 |
| D-22 | 2026-11-22 | Hosting budget | Free tiers first; paid upgrade (Vercel Pro + Neon paid) is a go-live gate; no code change | Hobby is non-commercial; 6 h restore | Paid from day one | CR-1 |
| D-23 | 2026-11-22 | Roles + resets | Branch admin = full admin for own branch; password reset by admin temp password at launch (email link later) | Staff without admin depend on admins | Email reset now | CR-1 |
| D-24 | 2026-11-22 | Privacy | Retention 3 years (unanswered links 90 days); export/erase by main admin across branches; notice placeholder until go-live | Notice needs legal check | Branch-scoped erase | CR-1 |
| D-25 | 2026-11-22 | Addresses + demo | Production on a new vercel.app address; demo frozen (tag demo-v1, demo branch) and taken offline at launch | — | Take over demo address | CR-1 |
| D-26 | 2026-11-22 | Phase-2 packages + contracts | drizzle-orm 0.45.4, @neondatabase/serverless 1.2.1, @node-rs/argon2 2.2.2, server-only; dev drizzle-kit 0.31.11, PGlite; exceljs removed; contract changes per LLD-phase2; free-plan backups = test data only | — | Auth.js / Better Auth; nightly encrypted dump | CR-1 |
| D-27 | 2026-11-23 | T-10b approval | Fix the last-admin race, then approve | Two admins demoting/deactivating at once can no longer leave zero main admins (row lock) · low | Approve as-is | T-10b |
| D-28 | 2026-11-24 | Slow sign-in on preview (3–4.5 s) | Fix region (sin1) inside T-05b, then approve; add T-31s CSP and T-32 list refresh in M3 | Functions next to Neon Singapore · if wrong: one line in vercel.json | Approve as-is | T-05b |
| D-29 | 2026-11-24 | argon2 raise (LLD §18.1) | Raise time cost t 2→8 (m 19456, p 1), opt-in server timing log, re-hash on next sign-in; tune after Vercel measurement | ≈80–160 ms hash · if wrong: ~1 h to retune | Raise memory+time; waive rule | T-33s |
| D-30 | 2026-11-24 | T-33s approval | Approve now, measure on Vercel later | argon2 t=8 live after next deploy · if hash <100 ms or p95 ≥1 s: ~1 h retune (D-29) | Request changes; reject | T-33s |
| D-31 | 2026-11-24 | T-31s CSP approach | Nonce + strict-dynamic; every page renders per request (no static/CDN pages) | Strong script CSP · a bit more server work per page view; app is mostly signed-in pages anyway | Hash-only CSP keeping static pages | T-31s |

## Tier 2 — decided by agents (overrule any time)
| ID | Date | Decision | Chosen | Agent | Task |
|---|---|---|---|---|---|
| A-01 | 2026-11-21 | Architect decisions (9) | see .results/plan/design-architect.md | architect | plan |
