# Low-level design — phase 2 (production) · §15–§27

> Continues `docs/LLD.md` (phase-1 §0–§14 keep their numbers). Same rules: numbered self-contained sections, stable numbers, one fact in one place. System view: `docs/HLD.md`. Product rules: `docs/SPEC.md`. Diagrams: `.results/lld/dataflow-phase2.mmd`, `.results/lld/schema-phase2.mmd`. Cap: 400 lines.
> As-built sync: **M3** (2026-11-24). Sections tagged "(as-built M3)" match the merged code; untagged parts are still the design for M4/M5.
> Phase-1 sections that phase 2 **replaces**: §2.5 → §17; §3, §4, §5 (local store, seed, local repos) → removed by §27; §7 `DemoRepo`, `signInAsDemo` → removed. Sections §1, §2, §6, §8–§14 stay valid and are **amended** by the contract changes in §17.2.

## §15 Phase-2 overview

### §15.0 Big picture
| Module | Responsibility | Talks to | Stories |
|---|---|---|---|
| §16 Database | Drizzle schema, one init migration, db client (Neon / PGlite) | Neon | all |
| §17 Server data access | Server repos implementing §2 interfaces, RPC route + registry, remote client DataAccess | §1, §16, §18, §19 | all |
| §18 Auth & sessions | Password hashing, sessions, cookies, lockout, step-up, proxy | §16 | US-01, 20, 23, 27, 28 |
| §19 Scope & roles | `Scope`, role checks, scope predicates | §18 | US-29 |
| §20 Live refresh | Activity tracker, poller | §17 client | US-05, G-6 |
| §21 Links & public form (server) | Tokens, link_tokens, open/submit, per-link limits, idempotent submit | §16–§19 | US-03–11 |
| §22 Job cards (server) | Entry, lookup, edit, idempotent create | §16–§19 | US-02, 26 |
| §23 Branches, advisors, users | Admin CRUD, session-ending rules | §16–§19 | US-20, 24, 25, 27 |
| §24 Customers & erasure | Search, CSV export, erase, erasure journal | §16–§19 | US-30 |
| §25 Daily cron | Retention, purge, housekeeping | §16, §24 | US-31 |
| §26 Setup, migrations, backup & restore | `scripts/admin.ts`, `scripts/migrate.ts`, restore procedure | §16, §18 | US-23, 32 |
| §27 Demo removal | What is deleted, how the demo stays frozen | — | §0.1 |

Milestones (HLD): **M3** §15–§19, §23, §26 setup · **M4** §20–§22 + §8/§9 screens · **M5** §24, §25, scoped §10–§14 screens, §26 restore, §27.

### §15.1 Stack additions (as-built M3)
| Concern | Choice | Rejected alternative (why) |
|---|---|---|
| Hosting region | Vercel functions in `sin1` (`vercel.json` `regions`), next to Neon Singapore (D-28); Git deploys of `main` off (`git.deploymentEnabled.main: false`) | default `iad1` (3–4.5 s sign-in on preview: every query crossed oceans) |
| ORM / migrations | Drizzle ORM 0.45.x + drizzle-kit 0.31.x | Prisma 7 (heavier, adapter ceremony); Kysely (no migrations/diffing) |
| Driver | `@neondatabase/serverless` Pool (WebSocket) via `drizzle-orm/neon-serverless` — interactive transactions | neon-http only (no interactive transactions) |
| Local dev + tests DB | PGlite (in-process Postgres) via `drizzle-orm/pglite` | Docker Postgres (extra setup); shared Neon dev branch for tests (network, flaky) |
| Auth | Hand-rolled DB sessions | Auth.js v5 (owner's original constraint; still beta, maintenance-only); Better Auth (lockout, must-change and branch scope stay custom anyway) |
| Hashing | `@node-rs/argon2` argon2id m=19456 KiB, t=8, p=1 (§18.1, D-29) | `@noble/hashes` (fallback only: slower, blocks event loop) |
| Transport | One JSON RPC route handler per repo method (POST) | Server Actions (client serialises calls: polling would queue behind saves); one REST route per endpoint (many shared route files) |
| Scheduler | Vercel Cron, `vercel.json` | GitHub Actions schedule (extra account/secret) |
| Rate limits | Postgres tables | Upstash Redis (extra account) |

### §15.2 Folder structure (new / changed) (as-built M3; `*` = not built yet, lands M4/M5)
```
src/proxy.ts                               §18.5 (auth redirect + CSP)
src/app/api/rpc/[repo]/[method]/route.ts   §17.3 (only data door; calls handleRpc)
src/app/api/cron/daily/route.ts *          §25
src/app/account/ admin/{branches,branches/[id],advisors,customers}/   new pages (thin); privacy/ *
src/features/{account,admin-branches}/     built; admin-customers/ * privacy/ *
src/server/                                server-only (`import "server-only"`; exemptions below)
  env.ts  log.ts  ctx.ts  scope.ts  audit.ts  rateLimit.ts   tokens.ts * erasure.ts * csv.ts *
  db/client.ts  db/schema/<table>.ts  db/schema/{index,enums,bytea}.ts
  auth/{password,session,cookies,stepUp}.ts
  repos/<name>.ts            Server<Name>Repo, one file per §2 repo (+ userRules.ts, unavailable.ts stub helper)
  rpc/<name>.ts  rpc/index.ts   method table per repo; index lists them (frozen)
  rpc/{handler,context,args,types}.ts   transport core (§17.3)
  createServerDataAccess.ts  server composition root
  jobs/cleanup.ts *
src/data/remote/{createRemoteDataAccess,rpcClient}.ts   client side; activity.ts * poller.ts * (§20)
src/lib/signInUrl.ts                       safeNext / signInUrl (shared by RoleGuard + sign-in)
src/domain/ + roles.ts jobCardInput.ts models.ts passwordPolicy.ts commonPasswords.ts retention.ts erasure.ts
drizzle/0000_init.sql  drizzle/meta/**  drizzle.config.ts   scripts/{admin,migrate}.ts (golive-check.ts *)   vercel.json
tests/unit/server/<area>/  tests/support/{pglite,serverCtx,e2e,fakeDataAccess}.ts  tests/e2e/global-setup.ts
```
`server-only` exemptions (run under tsx scripts or shared with `proxy.ts`): `env.ts`, `auth/password.ts` (commented), `auth/cookies.ts`; `ctx.ts`, `scope.ts`, `auth/session.ts` lack it without a comment (known minor T-17).

### §15.3 Layer map (dependency-cruiser additions, `severity: error`)
`app/api → server → domain`; `server → data/access` (types + `Result` only); `app (pages) → features → … → data/access`; `data/remote → data/access, domain`. Composition roots: `src/app/providers.tsx` (client, only importer of `@/data/remote`), `src/server/createServerDataAccess.ts` (server, only importer of `src/server/repos`).
| Rule | From | Forbidden to |
|---|---|---|
| server-hidden | `^src/(features\|components\|hooks\|data)` and `^src/app/(?!api/)` | `^src/server` |
| server-no-ui | `^src/server` | `src/(features\|components\|hooks\|app)`, `react` |
| remote-hidden | `^src/(features\|components\|hooks)`, `^src/app/(?!providers)` | `src/data/remote` |
| repos-via-root | `^src/(?!server/createServerDataAccess)` | `^src/server/repos` (also `src/app/api`) |
| domain-pure, access-pure, no-cross-feature, shared-no-features, no-circular | unchanged (§0.3); `access-pure` also forbids `src/server` | |
`local-hidden` is deleted with `src/data/local` (§27). ESLint: `no-restricted-imports` of `next/headers`, `@neondatabase/serverless`, `drizzle-orm*`, `@node-rs/argon2` outside `src/server/**`, `scripts/**`; `react/no-danger` error everywhere.

### §15.4 Packages (Tier 1, versions from research 2026-11-22; env-setup pins exact)
| Package | Version | License | Why | Rejected |
|---|---|---|---|---|
| drizzle-orm | 0.45.4 | Apache-2.0 | typed SQL, schema in TS | prisma 7.10.1, kysely 0.29.9 |
| @neondatabase/serverless | 1.2.1 | MIT | Neon WebSocket Pool, transactions | pg + pooled URL |
| @node-rs/argon2 | 2.2.2 | MIT | argon2id, prebuilt binaries | @noble/hashes 2.4.0 (fallback) |
| server-only | 0.0.1 | MIT | build error if server code reaches the client | convention only |
| drizzle-kit (dev) | 0.31.11 | MIT | SQL migration generation | Prisma Migrate |
| @electric-sql/pglite (dev) | latest 0.x (unverified; env-setup pins) | Apache-2.0 / PostgreSQL (unverified) | Postgres in-process for unit tests, e2e, local dev | Docker Postgres |
| **removed:** exceljs (dev) | — | — | seed pipeline gone (§27) | — |
Unchanged toolkit (§0.4): next 16, react 19, zod 4, TanStack Query 5, vitest, playwright, dependency-cruiser, eslint, prettier, tsx, gitleaks. Not added: next-auth, better-auth, Redis, CSV/date libraries.

### §15.5 Env vars (as-built M3) (`src/config/env.ts` public · `src/server/env.ts` server-only, lazy `getServerEnv()`; both zod; `.env.example` documents all)
| Key | Side | Required | Example | Use |
|---|---|---|---|---|
| `DATABASE_URL` | server | yes | `postgresql://…-pooler…/psf?sslmode=require` · local `pglite:./.pglite` | app connection (pooled) |
| `DATABASE_URL_UNPOOLED` | scripts | migrate/admin; as built also required at runtime when `VERCEL_ENV=production` (review m-8: to drop) | `postgresql://…/psf` | migrations, maintainer scripts |
| `CRON_SECRET` | server | yes (prod, 32+ chars) | 32+ random chars | §25 bearer |
| `IP_HASH_PEPPER` | server | yes (prod, 32+ chars) | 32 random bytes b64 | HMAC of client IP in limit tables (unset in dev/tests → per-process random pepper) |
| `APP_URL` | server | yes (prod, must be `https://`) | `https://chandra-psf-prod.vercel.app` | base of `/f/<code>` links (custom domain later = change this). Server-only: the phase-1 public key `NEXT_PUBLIC_APP_URL` is gone (row below); docs still naming it are stale |
| `AUTH_HASH_TIMING` | server | no (off) | `1` | opt-in: `1` writes one `{"evt":"auth.hash_timing","op","ms"}` line to stderr per argon2 hash/verify (§18.1, D-29). Read live by `isHashTimingEnabled()` in `src/server/env.ts`, not part of the zod schema or the cache |
| `NEXT_PUBLIC_POLL_SECONDS` | public | no (30) | `30` | §20 cadence |
| `NEXT_PUBLIC_COMPANY_NAME` · `_PRIVACY_PHONE` · `_PRIVACY_EMAIL` · `_DEALER_PHONE` | public | yes | placeholders until gate | notice, `/privacy`, link-state pages |
| ~~`NEXT_PUBLIC_DEMO_PASSWORD`~~, ~~`NEXT_PUBLIC_APP_URL`~~ | — | removed | — | §27; links now built on the server |
Non-production fallback (§0.5) kept for public keys; server keys have **no** fallback except `DATABASE_URL` → `pglite:memory` in tests.

## §16 Database (as-built M3)
- **Paths:** `src/server/db/schema/<table>.ts` (one table per file, frozen after foundation), `src/server/db/client.ts`, `drizzle.config.ts`, `drizzle/`.
- **Client:** `type Db = PgDatabase<PgQueryResultHKT, typeof schema>`, `type Tx` (the transaction handle); `async getDb(): Promise<Db>` per request (**returns a Promise**, not `Db`: PGlite is a dynamic import; callers `await getDb()`, e.g. `buildBaseCtx` §17.3): `DATABASE_URL` starting `pglite:` → PGlite (dir or memory, never in production: `env.ts` rejects `pglite:` when `VERCEL_ENV=production`), one instance per target per process, which **runs the drizzle migrator on first open** (a failed start is not cached); else `new Pool({ connectionString })` + `drizzle(pool, { schema })`; pool closed with `after(() => pool.end())`. `withTx(db, fn)` = `db.transaction(fn)`. `next.config.ts` lists `@electric-sql/pglite` in `serverExternalPackages`.
- **Conventions:** ids `uuid` default `gen_random_uuid()` (audit `bigserial`); times `timestamptz` UTC; `service_date date` (IST calendar day); enums as Postgres enums; `updated_at` + `version int` where optimistic concurrency applies.

### §16.1 Tables
| Table | Columns (key ones) | Constraints / indexes |
|---|---|---|
| `branches` | id, name, city, active, created_at | unique `lower(name)` |
| `users` | id, name, email, password_hash, role `role_enum(support,branch_admin,main_admin)`, branch_id → branches null, active, must_set_password, otp_expires_at null, last_sign_in_at, created_at, updated_at | unique `lower(email)`; check `(role='main_admin') = (branch_id is null)` |
| `sessions` | id_hash bytea PK (SHA-256 of token), user_id → users cascade, created_at, last_active_at | idx user_id |
| `login_attempts` | id bigserial, email_key text, ip_hash bytea, at, kind `('signin','stepup')`, user_id null | idx (email_key, at), (ip_hash, at), (user_id, at) |
| `rate_limits` | bucket text, key bytea, window_start timestamptz, count int | PK (bucket, key, window_start) |
| `advisors` | id, branch_id, name, active, created_at | unique (branch_id, lower(name)) |
| `job_cards` | id, branch_id, job_card_no (display), job_card_key (normalised), customer_name null, phone null, phone_key null (10 digits), reg_no null, reg_no_key null, model, vehicle_type, service_type, service_date, advisor_id, created_by, create_request_id uuid null, created_at, updated_at, erased_at null | unique (branch_id, job_card_key); unique create_request_id; idx phone_key, reg_no_key, (branch_id, service_date) |
| `visits` | id, job_card_id, branch_id (copy for scope), created_by → users, created_at, expires_at, opened_at, completed_at, cancelled_at, replaced_by → visits null | idx (branch_id, created_at desc), job_card_id |
| `link_tokens` | token_hash bytea PK, visit_id, created_by, created_at, superseded_at null | idx visit_id; at most one live per visit (partial unique on visit_id where superseded_at is null) |
| `questionnaires` | version int PK, definition jsonb, installed_at | v1 = `QUESTIONNAIRE_V1` |
| `responses` | id, visit_id unique, questions_version → questionnaires, answers jsonb (`AnswerMap`, zod on read/write), submission_id uuid, submitted_at, deleted_at null, updated_at, version | idx deleted_at |
| `alerts` | id, response_id unique cascade, branch_id, reasons jsonb, status `alert_status`, notes jsonb `[{at,by,text}]`, created_at, updated_at, version | idx (branch_id, status) |
| `audit_log` | id bigserial, at, actor_id null (null = system), actor_name, branch_id null, action text, entity_type, entity_id, old_value jsonb, new_value jsonb, note | idx (branch_id, id desc), (action, id desc); trigger `audit_log_guard`: no DELETE, no TRUNCATE; UPDATE only of old/new/note when `current_setting('psf.redact', true) = 'on'` (§24) |
| `erasure_journal` | job_card_id, erased_at, source `('request','retention')` | PK (job_card_id); no personal data |
Answers are one `jsonb` per response (not one row per answer): analytics loads whole responses; `toAnswerRows` (§1.1) stays unused. Diagram: `.results/lld/schema-phase2.mmd`.

### §16.2 Migrations
- `drizzle-kit generate` → `drizzle/NNNN_<name>.sql` + `drizzle/meta/_journal.json` (shared file: **migrations are serial**, never two tasks at once). The foundation writes the whole schema as `0000_init.sql` plus hand-added SQL for the audit trigger and partial index.
- Applied by `scripts/migrate.ts` (`drizzle-orm/neon-serverless/migrator`, `DATABASE_URL_UNPOOLED`; a `pglite:` URL uses the PGlite migrator instead, for local dev and e2e): Vercel build command `pnpm db:migrate && next build` (Preview → Neon `dev` branch, Production → `main`). Forward-only, additive first (expand → deploy → contract).

## §17 Server data access

### §17.1 Shape (as-built M3)
Server repos implement the **same §2 interfaces** (amended in §17.2): `class Server<Name>Repo implements <Name>Repo { constructor(protected readonly ctx: RequestCtx) }`, methods as arrow properties `m: <Name>Repo['m'] = (…) => guard(this.ctx, '<repo>.<m>', kind, async () => …)`. `RequestCtx { db: Db; clock: Clock; session: SessionInfo | null; scope: Scope | null; ip: string; cookies: SessionCookies; log: Logger }`, `SessionInfo { sessionId /* hex of the stored SHA-256 */; user: SessionUser { id; name; email; role; branchId; mustSetPassword }; createdAt; lastActiveAt }`, `Scope` and `MethodKind = 'read' | 'write'` all live in `ctx.ts`. Same §2.1 rules: async, never throw (`guard(ctx, where, kind, fn)` in `ctx.ts` maps exceptions → `SAVE_FAILED` (write) / `UNAVAILABLE` (read) and logs the error class only), role + branch checks inside. `createServerDataAccess(ctx): Omit<DataAccess, 'subscribe'>`. Domain §1 functions are reused unchanged (`validateSubmission`, `evaluateAlertReasons`, `reconcileAlert`, `computeOverview`, `visitStatus`, `buildWhatsAppUrl`).

### §17.2 Contract changes (Tier 1; foundation edits the frozen §1/§2 files once)
| Where | Change |
|---|---|
| §1.1 `Role` | `'support' \| 'branch_admin' \| 'main_admin'`; `roles.ts`: `isAdmin(role)`, `isMainAdmin(role)` (replaces `role === 'admin'` in §6 `RoleGuard`, §7 `landingPath`, §8 `useLinkActions`) |
| §1.1 types | `User` + `branchId \| null`, `branchName \| null`, `lastSignInAt`; new `Branch { id; name; city; active; createdAt }`; `Advisor` + `branchId`, `active`; `JobCard` + `id`, `branchId`, `erasedAt`, `customerName/regNo: string \| null`, `phone` lives here; `Visit` − `token`, − `phone`, `jobCardNo` → `jobCardId`, + `branchId`; `Filters` + `branchId?`; `AuditEntry` + `branchId`, `actorId: string \| null`; `AlertView`/`ResponseDetail` + `branchName`, `version` |
| §1.1 `AuditAction` | + `auth.sign_in`, `auth.lockout`, `user.update`, `user.reset_password`, `user.change_password`, `user.otp_reissue`, `user.recover`, `jobcard.create`, `jobcard.update`, `link.resend`, `branch.create/update/deactivate/reactivate`, `advisor.create/update/deactivate/reactivate`, `customer.export`, `customer.erase`, `response.purge`, `system.cleanup` |
| §2.1 | `ErrorCode` + `RATE_LIMITED`, `OTP_EXPIRED`, `NAME_IN_USE`; `Topic` + `branches`, `advisors` |
| §2.2 `DataAccess` | − `demo`; + `branches: BranchRepo`, `advisors: AdvisorRepo` (§23), `customers: CustomerRepo` (§24) |
| §7 `AuthRepo` | − `signInAsDemo`; + `changePassword(current, next): Result<void>` (BAD_PASSWORD, VALIDATION); `signIn` + RATE_LIMITED, OTP_EXPIRED; `setOwnPassword` only while `mustSetPassword` |
| §8 | see §21, §22: `listMyVisits` → `listVisits`, link issue returns `LinkIssued`, + `resendLink`, job card create/update, − `listFreshJobCards`, `VisitSummary` − `url`/`whatsappUrl`/`isMine` → + `createdByName`, `mine` |
| §9 `FeedbackRepo` | `submitResponse(token, answers, submissionId: string)`; FormContext unchanged (+ `rate_limited` state) |
| §10 | `getFilterOptions(f?: { branchId? })` → + `branches: Branch[]` (main admin only), advisors carry branch name |
| §11 | `listAlerts({ status?, branchId? })`; `updateAlert(id, patch, version)` → CONFLICT "Someone else changed this alert. Reload to see the latest." |
| §12 | `editResponse(id, answers, version, s)` (CONFLICT); list/detail/deleted rows + `branchName`; `DeletedRow` + `purgeOn` |
| §13 | `listAudit({ action?, branchId?, before?: string, limit?: number })` → `{ entries; nextCursor: string \| null }` (page 100) |
| §14 | see §23 `UserRepo` |

### §17.3 RPC transport (as-built M3)
- **Client** (`src/data/remote/`): `createRemoteDataAccess({ fetch, activity, poller, onUnauthenticated }): DataAccess` builds each repo as a `Proxy` whose any method `m` calls `rpc(deps, repo, m, args)`; `rpcClient.ts` `rpc()` → `POST /api/rpc/<repo>/<m>` body `{ args }`, headers `content-type: application/json`, `x-psf-active: 1|0` (§20); network or parse failure → `SAVE_FAILED`/`UNAVAILABLE` per the method kind; response is the `Result` JSON. As built the client's kind comes from `kindOf(method)` (name starts `get|list|count|current` → read), not from the registry (known minor T-18). `UNAUTHENTICATED` → `onUnauthenticated` → `invalidateQueries(SESSION_KEY)` → `RoleGuard` → `signInUrl(path, ended)` = `/sign-in?ended=1&next=<path>` ("Your session has ended. Sign in again."; `safeNext` in `src/lib/signInUrl.ts` accepts only same-origin relative paths). `providers.tsx` passes placeholder `activity` (always active) and `poller` (no-op) until §20 lands (M4).
- **Registry** (`src/server/rpc/<repo>.ts`, one per repo; arg schemas in `rpc/args.ts`, `RpcEntry`/`RpcTable` in `rpc/types.ts`): `export const visitsRpc = { listVisits: { kind: 'read', access: 'staff', input: z.tuple([...]) }, … } satisfies RpcTable<VisitRepo>`; `rpc/index.ts` `rpcTables` maps repo name → table (frozen), `findRpcEntry(repo, method)` uses own-property lookups only. **`access: 'public'` as built:** `auth.signIn`, `auth.signOut`, `auth.currentUser`, `feedback.*` (`getVisitByToken`, `markOpened`, `submitResponse`). `signOut` is public on purpose (deviation from the design list): an ended or expired session must still be able to clear its cookie; it only deletes the caller's own session row. `signInAsDemo` is gone from `AuthRepo` and the registry (§27). Built repos (M3): `auth`, `branches`, `advisors`, `users`; every other repo is a `ServerXRepo` whose methods return `unavailable()` (`repos/unavailable.ts`, "Not available yet.") and whose registry still holds the phase-1 method shapes (e.g. `jobCards.listFreshJobCards`) until its M4/M5 task rebuilds it.
- **Route** `POST /api/rpc/[repo]/[method]` (`runtime` default Node; `dynamic = 'force-dynamic'`), entry point `handleRpc(request, { repo, method })` in `src/server/rpc/handler.ts`: (1) `Origin` host must equal request host (else 403) and content-type JSON; (2) look up table entry (unknown → 404); (3) zod-parse args (→ `VALIDATION`); (4) `base = await buildBaseCtx(request)` (`src/server/rpc/context.ts`; `ip = clientIp(headers)`: first `X-Forwarded-For` entry, else `x-real-ip`, else `"unknown"`, known minor T-18), then `ctx = await withSession(base, request, kind)` reads the session once (§18.2; no cookie → no DB hit) and touches it when `kind === 'write'` or `x-psf-active: 1`; (5) per-IP flood limit 300/h (`hitIpLimit`, `PUBLIC_FLOOD_BUCKET`, `PUBLIC_FLOOD_LIMIT_PER_HOUR` in `src/server/rateLimit.ts`) on public methods **only when `ctx.session` is null**: a valid staff session skips it (D-32, T-34s; staff sharing one branch connection never trip it); a forged, expired or ended cookie reads as no session and is counted (cost: one indexed session lookup); over the limit → `RATE_LIMITED` "Too many requests. Try again later."; `hitIpLimit(ctx, { bucket, limit, windowMs? = 1 h })` is a fixed-window upsert on `rate_limits` keyed by `hashIp(ip)` = HMAC-SHA256 with `IP_HASH_PEPPER`; (6) staff method without session → `UNAUTHENTICATED` "Your session has ended. Sign in again." (HTTP 200 with Result); (7) `createServerDataAccess(ctx)[repo][method](...args)` (method missing on the repo → `UNAVAILABLE`); steps 4–7 are wrapped in `guard` (§17.1); (8) `Cache-Control: no-store`. Always HTTP 200 with a `Result` except 403/404 above.

## §18 Auth & sessions
- **Paths:** `src/server/auth/{password,session,cookies,stepUp}.ts`, `src/server/repos/auth.ts`, `src/proxy.ts`; screens §7 (+ `src/features/account/` My account, change password).

### §18.1 Passwords (`password.ts`) (as-built M3)
`hashPassword(pw): Promise<string>` (argon2id, **m 19456, t 8, p 1**: t raised 2 → 8 to reach ≥ 100 ms, D-29/D-30, T-33s), `verifyPassword(hash, pw): Promise<boolean>` (never throws; unreadable hash → false), `DUMMY_HASH` (same params) verified for unknown emails (equal timing); the module throws at load if `DUMMY_HASH` does not start with `ARGON2_PARAM_PREFIX`. `needsRehash(hash)` = hash lacks the current `$argon2id$v=19$m=…,t=…,p=…$` prefix → `ServerAuthRepo.rehashIfStale` re-hashes on the next successful sign-in, after the sign-in transaction, with `UPDATE users … WHERE id = ? AND password_hash = <the hash just verified>` (a reset/change in between wins; a failure is logged `auth.rehash` and never fails the sign-in). Timing log: `AUTH_HASH_TIMING=1` (§15.5) → stderr `auth.hash_timing` {op, ms}. **Pending:** owner measures on Vercel `sin1`; retune if hash < 100 ms or sign-in p95 ≥ 1 s (≈1 h, D-30). No `server-only` import (tsx `scripts/admin.ts` uses it; known minor m7). Policy in domain `passwordPolicy.ts`: `passwordProblem(pw): 'too_short' | 'too_common' | null` (≥ 8 chars, not in an embedded top-1000 list, case-insensitive). Temporary/one-time passwords follow the same policy; `scripts/admin.ts` generates 16-char random ones.

### §18.2 Sessions (`session.ts`, `cookies.ts`) (as-built M3)
| Item | Rule |
|---|---|
| Token | 32 random bytes base64url in cookie `__Host-psf_session` (prod) / `psf_session` (otherwise): httpOnly, Secure (prod), SameSite=Lax, Path=/, Max-Age 7 d. "prod" = `VERCEL_ENV === 'production'`, so **Preview deploys use `psf_session` without Secure** (still HTTPS-only in practice). `proxy.ts` accepts either name |
| Store | `sessions.id_hash = sha256(token)`; raw token never stored or logged |
| Valid when | user active, branch active (non-main), `now < last_active_at + idle(role)` (support 2 h, admins 12 h), `now < created_at + 7 d` |
| Touch | `last_active_at = now` when the request is a write or flagged active, at most once per 60 s |
| End | sign-out (this session); deactivate, reset password, role/branch change (all of that user's); change own password (all others) |
| API | `insertSession(tx, clock, userId): token` (row only, no cookie), `createSession(ctx, userId): sessionId` (insert + set cookie), `deleteSessionByToken(tx, token)`, `readSession(ctx): SessionInfo \| null` (never writes; §17.1 shape), `touchSession(ctx, info): boolean`, `endSession(ctx)` (delete own row + clear cookie), `endUserSessions(tx, userId, exceptId?)`, `idleLimitMs(role)`, `hashToken`, `TOUCH_INTERVAL_MS` |
`SessionCookies` interface (`get/set/clear`, in `ctx.ts`) is implemented by `createNextSessionCookies(store, production)` over `next/headers` `cookies()` in `buildBaseCtx` (§17.3) and by a fake in tests; `clear` writes an empty value with Max-Age 0.

### §18.3 Sign-in sequence (`ServerAuthRepo.signIn`) (as-built M3)
1. `emailKey = lower(trim(email))`; load the user (with branch active/name). 2. **Reserve a guess** (`reserve`, one transaction under `pg_advisory_xact_lock` on `signin-ip:<ipHash>` then `signin:<emailKey>`, so parallel requests cannot pass the caps): IP failures (kind signin) in last 15 min ≥ 30, or email failures ≥ 5 → `RATE_LIMITED` "Too many attempts. Try again in 15 minutes." (same message for both); else insert the attempt row now and note whether it is the email's 5th. 3. Verify against the hash or `DUMMY_HASH`. 4. Wrong / unknown → keep the attempt, audit `auth.lockout` if it was the 5th (once), `BAD_CREDENTIALS` "Email or password is incorrect". 5. Correct → delete only that reserved attempt row (earlier failures stay counted; known minor). 6. Inactive user or branch → `ACCOUNT_DISABLED`; `must_set_password` and `otp_expires_at <= now` → `OTP_EXPIRED`. 7. One transaction: delete the session of any cookie already held (no fixation), `insertSession`, `last_sign_in_at`, audit `auth.sign_in`; then re-hash a stale hash (§18.1), set the cookie, return `User` (`mustSetPassword` → `/set-password`). An admin reset or `scripts/admin.ts recover` deletes that email's signin attempts (`clearSignInFailures(tx, email)` exported from `repos/auth.ts`, clears the lock).
Other `ServerAuthRepo` methods: `setOwnPassword` (only while `mustSetPassword`, else FORBIDDEN; clears `otp_expires_at`, ends other sessions, audit `user.set_password`); `changePassword` (policy check, then `verifyStepUp` §18.4 with the current password, ends other sessions, audit `user.change_password`); `signOut` = `endSession`; `currentUser` → `User | null` (re-read from `users` for `branchName`).

### §18.4 Step-up (`stepUp.ts`) (as-built M3)
`verifyStepUp(ctx, s: StepUp): Promise<Result<void>>` (`STEP_UP_WINDOW_MS` 15 min, `STEP_UP_FAILURE_LIMIT` 5): reserves an attempt (kind stepup, per user, under `pg_advisory_xact_lock('stepup:<userId>')`) before verifying; right → delete that attempt, ok; wrong → `BAD_PASSWORD` "Password incorrect"; the 5th wrong (or already at 5) → end all the user's sessions, forget their stepup attempts, clear the cookie, `UNAUTHENTICATED` "Too many wrong passwords. Sign in again.". Used by `changePassword` (M3); response edit/delete/restore and customer erase (M5).

### §18.5 Proxy (`src/proxy.ts`, Next 16: renamed middleware, Node runtime, no `runtime` export) (as-built M3)
`export function proxy(req)`: matcher = every page `/((?!api|_next/static|_next/image|favicon.ico).*)`, `missing` the prefetch headers (`next-router-prefetch`, `purpose: prefetch`). Protected paths (`/admin/**`, `/support/**`, `/account`, `/set-password`) without a session cookie (`__Host-psf_session` or `psf_session`) → redirect `/sign-in?next=<path+query>`. Never reads the DB; not a security boundary: every RPC (§17.3) and `RoleGuard` re-verify. `/api/*` is outside the matcher.
**CSP (T-31s, D-31):** every other page response gets `Content-Security-Policy` from `export buildCsp(nonce, isDev)` (`isDev` = `isDevelopment` from `src/config/env.ts`): per-request nonce (base64 of `crypto.randomUUID()`), also passed to Next as request headers `x-nonce` + CSP. Redirects and prefetches (outside the matcher) carry no CSP; `/api/*` gets none (JSON only).
| Directive | Value |
|---|---|
| `script-src` | `'self' 'nonce-<n>' 'strict-dynamic'` (+ `'unsafe-eval'` dev only) |
| `style-src` / `style-src-elem` | `'self' 'nonce-<n>'` / same + `SONNER_STYLE_HASHES` (sonner's two runtime `<style>` tags; re-derive on sonner upgrade) |
| `style-src-attr` | `'unsafe-inline'` (React `style=` props; nonces cannot cover attributes) |
| other | `default-src 'self'`, `img-src 'self' data: blob:`, `font-src 'self'`, `connect-src 'self'` (dev + `ws: wss:`), `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'` |
- **All pages dynamic:** `src/app/layout.tsx` calls `await connection()` so Next can stamp the nonce on its scripts (no static/ISR/CDN pages; cost accepted, D-31). The layout's `beforeInteractive` script `csp-style-nonce` sets `window.__webpack_nonce__` from the first nonced script, for Radix scroll-lock `<style>` tags. `tests/e2e/foundation/csp.spec.ts` fails on any violation.
- Static headers stay in `next.config.ts` (all paths): `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`; `robots` noindex in the layout metadata.

## §19 Scope & roles (`src/server/scope.ts`, domain `roles.ts`) (as-built M3)
```ts
type Scope = { kind: 'all' } | { kind: 'branch'; branchId: string };   // declared in ctx.ts, re-exported
scopeOf(user): Scope;                                    // main_admin → all; branch user with no branch → throws (guard → error Result)
requireStaff(ctx) / requireAdmin(ctx) / requireMainAdmin(ctx): Result<SessionInfo>   // UNAUTHENTICATED | FORBIDDEN
branchFilter(col, scope, wanted?: string): SQL | undefined   // wanted only honoured for 'all'; branch scope ignores it
inScope(scope, branchId: string | null): boolean         // single-row checks → else NOT_FOUND
```
Messages: UNAUTHENTICATED "Your session has ended. Sign in again.", FORBIDDEN "You can't do that.".
| Repo area | support | branch_admin | main_admin |
|---|---|---|---|
| job cards, visits, links | own branch | own branch | all (no support screens; allowed) |
| analytics, alerts, responses, deleted, audit | FORBIDDEN | own branch | all + filter |
| users | FORBIDDEN | support users of own branch | all except self edit of role/branch |
| advisors | list own branch (active) | manage own branch | all |
| branches | own (read) | own (read) | manage |
| customers | FORBIDDEN | FORBIDDEN (G-4) | all |
Audit rows carry the branch of the entity; user/branch/advisor admin actions carry the target's branch.

## §20 Live refresh (`src/data/remote/activity.ts`, `poller.ts`)
- `ActivityTracker`: listens `pointerdown`, `keydown`, `scroll` (passive); `lastInputAt`; `isActive(now, ms)`. Header `x-psf-active: 1` when input within 60 s.
- `Poller` backs `DataAccess.subscribe`: every `POLL_SECONDS` while `document.visibilityState === 'visible'` and input within 15 min → emit all staff topics; on `visibilitychange` → visible, or first input after > 15 min idle → emit at once. Does not run on `/f/*`, `/privacy`, `/sign-in` (pathname check) or without a staff session.
- `providers.tsx`: QueryClient `refetchOnWindowFocus: false` (the poller owns refresh), `retry: false`; the form query uses `staleTime: Infinity` so it never re-counts as an open. As of M3 the tracker and poller are placeholders in `providers.tsx` (§17.3); this section lands in M4.

## §21 Links & public form (server: `repos/visits.ts`, `repos/feedback.ts`, `tokens.ts`)
```ts
interface LinkIssued { visit: VisitSummary; url: string; whatsappUrl: string | null }   // the only time the code leaves the server
interface VisitSummary { id; jobCardId; jobCardNo; customerName: string | null; regNo: string | null; model; serviceDate; phone: string | null;
  status: VisitStatus; createdAt; expiresAt; createdByName: string; mine: boolean }
interface VisitRepo { listVisits(q: { scope: 'mine' | 'branch'; search?: string }): Result<VisitSummary[]>;   // current links only, newest first, max 200
  createVisitLink(i: { jobCardId: string }): Result<LinkIssued>;  // NOT_FOUND, ALREADY_COMPLETED, CONFLICT (current link exists), VALIDATION (erased)
  resendLink(visitId): Result<LinkIssued>;       // new code, same visit + expiry; old token superseded; audit link.resend
  regenerateLink(visitId): Result<LinkIssued>;   // new visit, 7 d; old.replaced_by; audit link.regenerate
  cancelLink(visitId): Result<VisitSummary> }    // audit link.cancel
```
- `tokens.ts`: `newLinkCode(): { code: string /* 43 chars base64url of 32 bytes */; hash: Buffer }`, `hashCode(code)`. URL = `env.APP_URL + '/f/' + code`. Any branch support user may act (G-8); resend/regenerate/cancel on completed, cancelled or replaced → CONFLICT "This link can no longer be changed"; resend on expired → CONFLICT (use Regenerate).
- `getVisitByToken(code)`: per-link limit `rate_limits('open', hash)` 30/h → `{ state: 'rate_limited' }`; lookup `link_tokens` by hash → none → `invalid`; superseded or visit `replaced_by` → `expired, replaced: true`; job card erased or visit cancelled → `invalid`; then `visitStatus`. Returns name, model, reg. no, service date, questionnaire of the current version.
- `markOpened(code)`: `UPDATE visits SET opened_at = now WHERE id = ? AND opened_at IS NULL AND completed_at IS NULL` (called by client JS after render, so link-preview robots never set Opened).
- `submitResponse(code, answers, submissionId)` (one transaction): per-link limit 5/h → `RATE_LIMITED`; resolve as above (expired → CONFLICT, invalid → NOT_FOUND); `UPDATE visits SET completed_at = now, opened_at = coalesce(opened_at, now) WHERE id = ? AND completed_at IS NULL AND cancelled_at IS NULL RETURNING`; 0 rows → if a response with the same `submission_id` exists → ok with its `callbackRequested` (G-15) else `ALREADY_COMPLETED`; `validateSubmission` (`VALIDATION`) → insert response → `evaluateAlertReasons` → alert + audit `alert.create` (actor system, visit's branch). `submissionId` is a UUID kept in the §9 draft (`draft.ts` gains it).

## §22 Job cards (server: `repos/jobCards.ts`; domain `jobCardInput.ts`, `models.ts`)
```ts
interface JobCardView extends JobCard { advisorName: string; branchName: string; editable: boolean /* no completed visit, not erased */ }
type JobCardInput = { jobCardNo; customerName; phone: string | null; regNo; model; modelOther?: string; serviceType; serviceDate: ISODate; advisorId };
interface JobCardRepo { getJobCard(jobCardNo): Result<{ jobCard: JobCardView; current: VisitSummary | null }>;   // own branch only; NOT_FOUND
  createJobCard(i: JobCardInput & { requestId: string }): Result<JobCardView>;   // VALIDATION fields; CONFLICT fields ['jobCardNo'] "JC-… already exists at this branch"
  updateJobCard(id, patch: Partial<JobCardInput>): Result<JobCardView> }         // CONFLICT "Feedback already received" when not editable; audit jobcard.update old/new
```
- `jobCardInputSchema(now)` (zod, domain) = SPEC F-2 table: number 3–20 `[A-Za-z0-9 -]`, name ≤ 80, Indian mobile or null, reg. no 6–12 after strip (stored upper-case, display spaced), model from `HONDA_MODELS` (`models.ts`: name → vehicle type; "Other" needs `modelOther` + vehicle type), service date ≤ today IST and ≥ today − 60, advisor active in the user's branch (server check). Branch = session user's branch; inactive branch → FORBIDDEN "Account disabled, contact admin".
- Idempotent create: same `requestId` already stored → return that card (G-15). Keys: `normalizeJobCardNo` (§1.5), `phone_key` = 10 national digits, `reg_no_key` = upper alnum.

## §23 Branches, advisors, users (server repos `branches.ts`, `advisors.ts`, `users.ts`; screens `src/features/admin-branches/`, `admin-users/` (§14 extended)) (as-built M3)
```ts
interface BranchRepo { listBranches(): Result<BranchWithCount[]>;   // any staff; branch users get only their own; staffCount = active users; ordered by name
  createBranch(i: { name; city }): Result<Branch>;  updateBranch(id, p: { name?; city? }): Result<Branch>;   // NAME_IN_USE "A branch with this name already exists"; VALIDATION "Enter the branch <field>."; NOT_FOUND "That branch no longer exists."
  setBranchActive(id, active): Result<Branch> }     // main admin only (all writes); no-op when unchanged; deactivating ends its staff's sessions (one user at a time, known minor)
interface AdvisorRepo { listAdvisors(f: { branchId?: string; activeOnly?: boolean }): Result<AdvisorWithBranch[]>;   // support: own branch, active only
  createAdvisor(i: { branchId; name }): Result<Advisor>; renameAdvisor(id, name): Result<Advisor>; setAdvisorActive(id, active): Result<Advisor> }   // admins in scope; outside → NOT_FOUND; NAME_IN_USE "An advisor with this name already exists in this branch"
interface UserRepo { listUsers(f?: { branchId? }): Result<User[]>;   // admins; branch admin always own branch
  createUser(i: { name; email; role: Role; branchId: string | null; tempPassword }): Result<User>;  // VALIDATION, EMAIL_IN_USE, FORBIDDEN (role/branch outside caller's rights), VALIDATION "Add a branch first" / "Choose a branch" / "Choose an active branch"; must_set_password + otp_expires_at now + 72 h
  updateUser(id, p: { name?; email?; role?; branchId? }): Result<User>;   // G-9 rights; role/branch change ends sessions; no-op patch → current user, no audit
  setUserActive(id, active): Result<User>;  resetPassword(id, tempPassword): Result<void> }   // reset: must_set_password, otp_expires_at + 72 h, end sessions, clearSignInFailures (§18.3); audit {mustSetPassword:true} only
```
Pure rules in `src/server/repos/userRules.ts`: `assertCanManage(actor, target, changes: Change[])` (`Change = 'profile'|'role'|'branch'|'active'|'reset'`), `cleanPatch`, `tempPasswordError`, `wantedBranch`, `diff`/`snapshot` (audit old → new of changed fields only), `toUser`, `OTP_TTL_MS`. Rules: branch admin acting outside own branch → NOT_FOUND; branch admin may touch only support users of own branch, never self, never role/branch; main admin may change own profile only (no own role/branch/active/reset: self uses Change password); the last active main admin cannot be deactivated or demoted (`CONFLICT` "There must be at least one active main admin."; `keepsAnAdmin` locks the active main-admin rows `FOR UPDATE`, D-27). A branch move is audited under the new branch only (known minor). Password fields never audited.
Audit actions as built: `branch.create/update/deactivate/reactivate`, `advisor.create/deactivate/reactivate` and **`advisor.rename`**, `user.create/update/deactivate/reactivate/reset_password`. **Open item:** `repos/advisors.ts` writes `advisor.rename`, but the `AuditAction` union (`src/domain/types.ts`, `schemas.ts`) and `auditFormat.ts` only know `advisor.update`; align one side in M4 (≈3 min; code unchanged by this sync). `isUniqueViolation(e)` (Postgres 23505 on the error or its cause) is exported from `repos/branches.ts` and imported by `advisors.ts` and `users.ts` (known minor: move to a db helper).
**Admin list refresh (T-32):** after a successful save the screen puts the saved row into the cached list at once, then refetches. `src/features/admin-branches/listCache.ts` `mergeBranch(queryClient, saved)` (key `BRANCHES_LIST_KEY = ['branches','list']`; keeps the row's `staffCount`, new row → 0) via `useRefreshingMutation(fn, merge?)`, which then invalidates `['branches']` and `['advisors']`; `src/features/admin-users/listCache.ts` `mergeUser(queryClient, saved)` (key `USERS_LIST_KEY = ['users','list']`) via `useUsersMutation`. Both replace by id or append, and leave an empty or failed cache alone.

## §24 Customers & erasure (`repos/customers.ts`, `src/server/erasure.ts`, domain `erasure.ts`)
```ts
interface CustomerRow { jobCardId; branchName; serviceDate; customerName: string | null; regNo: string | null; linkStatus: VisitStatus | null; hasResponse: boolean; erased: boolean }
interface CustomerRepo { searchCustomers(q: { phone?: string; regNo?: string }): Result<CustomerRow[]>;   // main admin; by phone_key / reg_no_key across branches
  exportCustomers(jobCardIds: string[]): Result<{ filename: string; csv: string }>;   // audit customer.export {count}
  eraseCustomers(jobCardIds: string[], s: StepUp): Result<{ erased: number }> }       // step-up; audit customer.erase {count}
```
- `eraseJobCards(tx, ids, source, now)` (shared with §25): job card name/phone/reg no (+ keys) → null, `erased_at`; each response (incl. deleted) `answers = stripFreeText(answers)` (domain: drops Q14, Q2a, Q13a and every `.text`); alert notes text → "[erased]"; `SET LOCAL psf.redact = 'on'` then audit rows of those job cards/visits/responses/alerts get `old_value`/`new_value` → `"[erased]"` where they held personal fields; insert `erasure_journal`; after commit `log.event('erasure', { source, jobCardIds })` (ids only). Links stop working via §21 (`erased_at`).
- CSV: hand-written RFC 4180 writer (`src/server/csv.ts`), UTF-8 BOM for Excel, columns: branch, job card, service date, name, phone, reg. no, model, link status, submitted at, each question code. Values starting `= + - @` prefixed with `'` (formula injection).

## §25 Daily cron (`src/app/api/cron/daily/route.ts`, `src/server/jobs/cleanup.ts`, `vercel.json`) (as-built M3: cut-offs only)
- `vercel.json`: `{ "crons": [{ "path": "/api/cron/daily", "schedule": "30 21 * * *" }] }` (03:00 IST; Hobby runs within that hour). As of M3 `vercel.json` holds only `buildCommand`, `regions` (§15.1) and `git`; the `crons` entry, route and job land in M5.
- Cut-offs built (M3): domain `retentionCutoffs(now): { unansweredOn, answeredOn, deletedBefore }` and `retentionDueDate(serviceDate, answered)` in `src/domain/retention.ts`. The two erase steps are **inclusive** (`service_date <= cut-off`, matching SPEC F-10's worked example); purge stays strict (`deleted_at < deletedBefore`). `GET` only; `Authorization` must equal `Bearer ${CRON_SECRET}` (`timingSafeEqual`) else 401; `maxDuration = 300`.
- `runDailyCleanup(db, clock): Promise<CleanupCounts>`; each step loops in batches of 500 until done or 240 s elapsed (next run continues; all steps idempotent):
| Step | Rule (domain `retention.ts` cut-offs, IST dates) |
|---|---|
| unanswered | job cards not erased, no visit with `completed_at`, `service_date <= today − 90 d` → `eraseJobCards(…, 'retention')` |
| answered | job cards not erased with a completed visit, `service_date <= today − 3 y` → erase |
| purge deleted | responses `deleted_at < now − 30 d` → delete alert + response; audit `response.purge` per row (no answers) |
| sessions | expired by §18.2 rules → delete |
| attempts, limits | `login_attempts.at`, `rate_limits.window_start` older than 24 h → delete |
| summary | one audit `system.cleanup` (actor null, name "System") with counts |

## §26 Setup, migrations, backup & restore (as-built M3: setup script)
- **`scripts/admin.ts`** (tsx, `DATABASE_URL_UNPOOLED`, or a `pglite:` `DATABASE_URL` for local/e2e; exports `initAdmin`, `reissueOtp`, `recoverMainAdmin`, `generateOneTimePassword` for tests): `init --name --email` → under a transaction-scoped advisory lock (concurrent runs serialise), refuses ("Users already exist; nothing changed") if any user; installs questionnaire v1 (idempotent); creates `main_admin` with a printed 16-char one-time password, `must_set_password`, `otp_expires_at = now + 72 h`; audit `user.create` actor system. `reissue --email` → new one-time password + 72 h, ends the user's sessions (only for users still `must_set_password`); `recover --email --no-admin-can-sign-in` → only for an existing, **active** `main_admin` (a deactivated one is refused: reactivating needs an owner decision) (the flag records that the maintainer checked no main admin can sign in, G-14): sets a one-time password, `must_set_password`, 72 h, clears that email's attempts, ends sessions; both audited `user.otp_reissue` / `user.recover` actor system. Not built yet: `scripts/golive-check.ts` (fails on placeholder env values; `pnpm golive:check` is declared) and `reapply-erasures` (M5). DB opening is duplicated with `migrate.ts` (known minor).
- **Backup (free plan):** Neon's own 6 h restore only; **no real customer data before the gate**, so no extra dump (owner approval item; optional encrypted dump design below kept on the shelf). **Paid plan:** Neon history retention set to 7 days (console, no code).
- **Restore (DEPLOY.md, G-5):** default = Neon "restore to point in time" **into a new branch**, query it, copy back only the damaged rows with SQL. Full rollback (owner go-ahead): restore the main branch (Neon keeps the pre-restore state as a backup branch, unverified) → read `erasure_journal` rows newer than the restore point **from that backup branch** → re-run `eraseJobCards` for those ids (`scripts/admin.ts reapply-erasures --from <branch-url>`). Host logs (`erasure` events) are a second copy only (log retention is short).
- **Shelved option (if the owner wants real data on free, or an off-site copy later):** GitHub Actions nightly `pg_dump -Fc` → `age` encryption with the owner's public key (private key offline with the owner) → workflow artifact, 7-day retention, private repo; erasures after a dump are re-applied from the journal on restore. Not built unless approved.

## §27 Demo removal
- **Before the first phase-2 merge to main:** tag `demo-v1` on the current main; point the demo Vercel project (`chandra-psf`) at a `demo` branch created from that tag (or turn off its Git deploys) so production code never deploys to the demo address; take it offline at launch (gate).
- **Deleted from main:** `src/data/local/**`, `src/data/seed/**`, `scripts/build-seed.ts`, `scripts/seed/**`, `src/data/access/repos/demo.ts`, `ResetDemoDialog`, `DemoLabel`, `useShellActions.simulateFailedSave` + menu items, `signInAsDemo`/`DemoWho`/picker/password hint, `listFreshJobCards` + presenter hint, `token.ts` payload tokens, check.sh seed step, exceljs, `NEXT_PUBLIC_DEMO_PASSWORD`, their tests. Unit tests of shared hooks/screens switch to an in-memory fake `DataAccess` in `tests/support/fakeDataAccess.ts`.

## Frozen after the phase-2 foundation
`src/server/{env,log,ctx,scope,audit,tokens,rateLimit,erasure,csv,createServerDataAccess}.ts`, `src/server/db/**`, `src/server/auth/**`, `src/server/rpc/index.ts`, `src/app/api/rpc/**`, `src/proxy.ts`, `src/data/remote/**`, `src/domain/{types,schemas,roles,jobCardInput,models,passwordPolicy,retention,erasure}.ts`, `src/data/access/**`, `src/app/providers.tsx`, `drizzle/**` (serial migrations), `drizzle.config.ts`, `vercel.json`, `scripts/{migrate,admin}.ts`, `tests/support/**`, plus the phase-1 frozen list (§ Frozen after the foundation) minus deleted files. Feature tasks own exactly one `repos/<name>.ts` + `rpc/<name>.ts` + their feature folder + `tests/unit/server/<name>/`.

## Changes since last milestone
| Milestone | Section | Change | Why | Ref |
|---|---|---|---|---|
| CR-1 design | §15–§27 | Phase-2 design added; §2.5, §3–§5 superseded | Production phase 2 | CR-1 |
| M3 | §15.1 | Functions pinned to Vercel `sin1`; Git deploys of `main` off | 3–4.5 s sign-in from `iad1` to Neon Singapore | D-28, T-05b |
| M3 | §15.1, §18.1 | argon2id time cost 2 → 8 (m 19456, p 1); `needsRehash` + guarded re-hash on next sign-in; `AUTH_HASH_TIMING` log; owner still measures on `sin1` | hash 21–38 ms on Vercel, under the 100 ms trigger | D-29, D-30, T-33s |
| M3 | §15.2 | Folder map marks built vs pending; adds `rpc/{handler,context,args,types}.ts`, `repos/{userRules,unavailable}.ts`, `src/lib/signInUrl.ts`, `server-only` exemptions | as built | T-17, T-18, T-02b |
| M3 | §15.5 | `AUTH_HASH_TIMING` row; `DATABASE_URL_UNPOOLED` required at runtime in production (to drop, m-8); secrets 32+ chars; `APP_URL` https + server-only | as built | T-15, T-33s |
| M3 | §16 | `getDb(): Promise<Db>` (design said `Db`); PGlite self-migrates on first open; `audit_log` also blocks TRUNCATE | PGlite is a dynamic import | T-15 m-4 |
| M3 | §17.1 | `guard(ctx, where, kind, fn)` signature; `SessionInfo` / `SessionUser` shape; arrow-property repo methods | as built | T-17 |
| M3 | §17.3 | `auth.signOut` is `public` (design listed only signIn, currentUser, feedback.*); `signInAsDemo` removed; non-M3 repos are `unavailable()` stubs with phase-1 registry shapes; client kind from method name; `clientIp` header order; session read before the flood limit | an ended session must still clear its cookie | T-18, T-01b |
| M3 | §17.3 | Valid staff session skips the per-IP public flood limit (300/h); no, forged or expired session still counted | e2e and shared branch connections tripped the limit on `currentUser` | D-32, T-34s |
| M3 | §18.2 | Cookie name/Secure keyed on `VERCEL_ENV === 'production'` (Preview uses `psf_session`); session API list as built | as built | T-17 |
| M3 | §18.3 | Sign-in reserves the attempt under advisory locks before verifying; IP cap uses the lockout message; cookie-held session deleted on sign-in; correct sign-in deletes only its own attempt | parallel-cap race fix (T-20 Major) | T-02b, T-20 |
| M3 | §18.4 | Step-up reserve-before-verify under a per-user advisory lock; 5th wrong clears the cookie with "Too many wrong passwords. Sign in again." | parallel-cap race fix | T-20 |
| M3 | §18.5 | Content-Security-Policy with per-request nonce + `strict-dynamic` set in `src/proxy.ts`; matcher now every page (minus prefetch); every page dynamic (`connection()`); sonner hashes; `__webpack_nonce__` script | owner follow-up: no CSP on the preview | D-31, T-31s |
| M3 | §19 | `scopeOf` throws for a branch user without a branch; messages listed | as built | T-17 |
| M3 | §20 | Tracker/poller are placeholders in `providers.tsx` until M4 | not in M3 scope | T-01b |
| M3 | §23 | Repo comments/messages as built; `userRules.ts` split; last-admin `FOR UPDATE`; reset sets OTP expiry 72 h and clears the sign-in lock; list refresh via cache merge | as built; T-32 owner follow-up | T-21, T-10b, T-32 |
| M3 | §23 | **Open:** audit action `advisor.rename` written while `AuditAction` / `auditFormat.ts` say `advisor.update`; align one side in M4 (code not changed) | drift found in sync | T-21 |
| M3 | §25 | Retention erase cut-offs inclusive (`<=`), purge strict; only the domain cut-offs built | matches SPEC F-10 example | T-16 |
| M3 | §26 | `init` advisory lock; `reissue` ends sessions; `recover` refuses a deactivated main admin; `golive-check.ts` and `reapply-erasures` not built yet | as built | T-19 |
