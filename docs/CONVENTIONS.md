# CONVENTIONS — Chandra Honda PSF (phase 1 demo · phase 2 production rules marked **P2**)

> Written by the Architect with the LLD and approved by the owner. Every coder reads this
> before every task; the Tester enforces section 6 automatically, and the Reviewer
> enforces sections 2–5. Module details: `docs/LLD.md` (cited as §n).

## 1. Stack-specific style
- TypeScript strict (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`); no `any`, no non-null `!` outside tests; named exports only (except Next.js `page.tsx`/`layout.tsx` defaults).
- React function components + hooks. Screens are client components (`'use client'`); `src/app/**/page.tsx` is a thin wrapper that renders one feature screen.
- Path alias `@/` = `src/`. File names: components `PascalCase.tsx`, everything else `camelCase.ts`.
- UI only from shadcn/ui (`src/components/ui`) + Tailwind utilities + tokens in `globals.css`; no inline `style`, no hex colours in components (use `--brand`, status tokens). Icons: lucide only.
- Copy text comes from SPEC (exact wording). Dates shown with `formatIST*` (LLD §1.5); stored as UTC ISO / IST `YYYY-MM-DD`.
- Every interactive element ≥ 48 px tap target, labelled inputs, keyboard reachable; check 360 px and 1440 px.
- Zod at every boundary: env (§0.5), stored collections (§3), seed fixture (§4), submissions (§1.2).

## 2. Layering (dependencies point inward only)
```
src/app (routes, thin)  →  src/features/<name>  →  src/components/shared, src/hooks  →  src/data/access (interfaces)  →  src/domain (pure)
                                                                    src/data/local (phase-1 impl)  →  src/data/access, src/domain
```
- Screens read and write **only** through hooks over `DataAccess` (§2). Never import `@/data/local`; only `src/app/providers.tsx` (composition root) does.
- No `localStorage` / `sessionStorage` outside `src/data/local/**` and `src/features/feedback-form/draft.ts`.
- A feature never imports another feature; anything two features need is shared and belongs to the foundation.
- `src/domain` imports nothing but `zod`: no React, no browser APIs, no `Date.now()` (take `now`).
- Role checks live inside repositories (§2.1); `RoleGuard` (§6) is only the UI redirect.
- Enforced by dependency-cruiser rules in LLD §0.3 and the ESLint `no-restricted-globals` rule.
- **P2 server side** (LLD-phase2 §15.3): `src/app/api/** → src/server → src/domain` (+ types from `src/data/access`). Every file in `src/server/**` starts with `import "server-only"`. Only `src/server/createServerDataAccess.ts` imports `src/server/repos/*`; only `src/app/providers.tsx` imports `src/data/remote`. `next/headers`, drizzle, the Neon driver and argon2 are imported only in `src/server/**` and `scripts/**`.
- **P2 security rules:** every server repo method starts with a `require*` role check and filters by `Scope` (LLD §19); scope comes from the session, never from client input (a `branchId` argument only narrows a main admin's view). Out-of-scope single rows → `NOT_FOUND`. No `dangerouslySetInnerHTML`. Raw link codes, session tokens and passwords are never stored, logged or audited (hashes only).

## 3. SOLID: what it means in this project

| Principle | Rule here |
|---|---|
| **S**ingle responsibility | Repos do storage + permission; domain does rules/maths; components render. A screen component composes blocks, it doesn't compute metrics. |
| **O**pen/closed | Variation points: (1) `DataAccess` (local now, remote in phase 2); (2) questionnaire config + `show_if` (new question = config entry); (3) form field registry `Record<QuestionType, FieldComponent>` (new type = new file + map entry); (4) `Clock`. No `if (phase2)` or `switch` on question code in screens. |
| **L**iskov substitution | Every repo method honours §2.1: async, never throws, returns the listed error codes only. No stubs left at milestone end (`UNAVAILABLE` stubs are foundation-only placeholders). |
| **I**nterface segregation | One small repo interface per feature (`VisitRepo`, `AlertRepo`…), aggregated in `DataAccess`; components take props of the slice they render. |
| **D**ependency inversion | Repos receive `store`, `clock`, `session` via constructor; storage/locks/window are injected in `createLocalDataAccess`; wiring only in `providers.tsx`. **P2:** server repos receive one `RequestCtx` (`db`, `clock`, `session`, `scope`, `cookies`, `log`); wiring only in `createServerDataAccess` and the RPC route. |

**Where to abstract:** only the four variation points above. Elsewhere plain functions and concrete components. **P2 adds:** (5) the db client (`Db`: Neon in production, PGlite in tests/dev), (6) `SessionCookies` (Next cookies vs test fake). `DataAccess` now has the remote implementation; the local one is deleted (LLD-phase2 §27).

## 4. Limits
- `.ts` function ≤ 40 lines; React component function ≤ 80 lines (split into sub-components); cyclomatic complexity ≤ 10; parameters ≤ 5 (use an object).
- File ≤ 300 lines. `src/components/ui/**` (generated) and `src/data/seed/seed.json` are exempt.
- No commented-out code, no `console.log` (ESLint `no-console`), no TODOs without a task ID.

## 5. Errors, logging, config, tests
- Errors: repositories return `Result` with an `ErrorCode` (§2.1); screens map codes to SPEC messages; any write shows `SaveState` (saving / "Couldn't save, try again" + Retry, input kept).
- Logging: none in phase 1 beyond dev-only `console.error` in the store's catch; never log answers, names or phones. **P2:** server logs only through `src/server/log.ts` (`log.event(name, fields)`, `log.error(where, errorClass)`): JSON lines with ids, counts and error classes; never names, phones, reg. nos, answers, emails, IPs, codes, tokens or passwords.
- Config: only via `src/config/env.ts` (zod); no magic constants — 7-day expiry, 1000-char limit, 30-day default range live in `src/domain/constants.ts`. **P2:** server secrets only via `src/server/env.ts`; retention ages, idle timeouts, lockout and rate limits are named constants in `src/domain/constants.ts`.
- **P2 database:** schema only in `src/server/db/schema/*`, changes only by a new drizzle migration (serial, one task at a time; never edit an applied migration); multi-row writes in one transaction; optimistic concurrency via `version` where LLD says so.
- **P2 tests:** server repos are tested against PGlite with the real migration applied (`tests/support/pglite.ts`) and a fixed `Clock`, through the repo interface; never mock Drizzle. Screens/hooks tests use `tests/support/fakeDataAccess.ts`. E2E runs `next dev` on `DATABASE_URL=pglite:memory` seeded through `scripts/admin.ts init` + RPC calls, never a seed file.
- Tests (Vitest, `tests/unit/<area>/*.test.ts`): Arrange-Act-Assert, one behaviour per test, `it('<condition> → <expected>')` inside `describe('<unit>')`. Repos tested against an in-memory `Storage` fake and a fixed `Clock` from `tests/support/`; never mock domain functions.
- E2E (Playwright, `tests/e2e/<feature>/*.spec.ts`): one spec per acceptance criterion tagged with its S-xx/AC id in the title; viewports 360×780 and 1440×900; helpers `signInAs`, `resetDemo`, `openSecondTab` live in `tests/support/e2e.ts`.

## 6. Automated checks (`scripts/check.sh` must pass; Tester runs it on every task)

Coders and the debugger run `CHECK_NO_COVERAGE=1 scripts/check.sh`; the Tester runs the full script and owns coverage.

| Check | Command |
|---|---|
| Lint + format | `eslint .` (typescript-eslint `strictTypeChecked` + `eslint-config-next`) + `prettier --check .` |
| Types | `tsc --noEmit` |
| Complexity / size | eslint `complexity: 10`, `max-lines-per-function: 40` (`.ts`) / `80` (`.tsx`), `max-params: 5`, `max-lines: 300` |
| Layer rules | `depcruise src --config .dependency-cruiser.cjs` (LLD §0.3) |
| Unit + coverage | `vitest run --coverage`; thresholds 80 % lines/functions/branches/statements on `src/domain/**`, `src/data/**`, `src/hooks/**` |
| E2E | `playwright test` (Chromium only; runs in both modes) |
| Seed fixture | `tsx scripts/build-seed.ts --check` — **P2: removed** with the seed pipeline |
| **P2** Migrations in sync | `drizzle-kit check` + `drizzle-kit generate` produces no new file (schema and SQL agree) |
| **P2** Coverage scope | thresholds also on `src/server/**` (80 %) |
| Build | `next build` |
| Secrets in code | `gitleaks detect --no-git --redact` |
