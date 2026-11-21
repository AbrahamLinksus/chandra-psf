# CONVENTIONS — Chandra Honda PSF (phase 1 demo)

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

## 3. SOLID: what it means in this project

| Principle | Rule here |
|---|---|
| **S**ingle responsibility | Repos do storage + permission; domain does rules/maths; components render. A screen component composes blocks, it doesn't compute metrics. |
| **O**pen/closed | Variation points: (1) `DataAccess` (local now, remote in phase 2); (2) questionnaire config + `show_if` (new question = config entry); (3) form field registry `Record<QuestionType, FieldComponent>` (new type = new file + map entry); (4) `Clock`. No `if (phase2)` or `switch` on question code in screens. |
| **L**iskov substitution | Every repo method honours §2.1: async, never throws, returns the listed error codes only. No stubs left at milestone end (`UNAVAILABLE` stubs are foundation-only placeholders). |
| **I**nterface segregation | One small repo interface per feature (`VisitRepo`, `AlertRepo`…), aggregated in `DataAccess`; components take props of the slice they render. |
| **D**ependency inversion | Repos receive `store`, `clock`, `session` via constructor; storage/locks/window are injected in `createLocalDataAccess`; wiring only in `providers.tsx`. |

**Where to abstract:** only the four variation points above. Elsewhere plain functions and concrete components.

## 4. Limits
- `.ts` function ≤ 40 lines; React component function ≤ 80 lines (split into sub-components); cyclomatic complexity ≤ 10; parameters ≤ 5 (use an object).
- File ≤ 300 lines. `src/components/ui/**` (generated) and `src/data/seed/seed.json` are exempt.
- No commented-out code, no `console.log` (ESLint `no-console`), no TODOs without a task ID.

## 5. Errors, logging, config, tests
- Errors: repositories return `Result` with an `ErrorCode` (§2.1); screens map codes to SPEC messages; any write shows `SaveState` (saving / "Couldn't save, try again" + Retry, input kept).
- Logging: none in phase 1 beyond dev-only `console.error` in the store's catch; never log answers, names or phones.
- Config: only via `src/config/env.ts` (zod); no magic constants — 7-day expiry, 1000-char limit, 30-day default range live in `src/domain/constants.ts`.
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
| Seed fixture | `tsx scripts/build-seed.ts --check` (regenerates in memory, fails if it differs from the committed `seed.json`) |
| Build | `next build` |
| Secrets in code | `gitleaks detect --no-git --redact` |
