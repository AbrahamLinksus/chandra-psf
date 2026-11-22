# Low-level design — phase 2 (production) · §15–§27

> Continues `docs/LLD.md` (phase-1 §0–§14 keep their numbers). Same rules: numbered self-contained sections, stable numbers, one fact in one place. System view: `docs/HLD.md`. Product rules: `docs/SPEC.md`. Diagrams: `.results/lld/dataflow-phase2.mmd`, `.results/lld/schema-phase2.mmd`. Cap: 400 lines.
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

### §15.1 Stack additions
| Concern | Choice | Rejected alternative (why) |
|---|---|---|
| ORM / migrations | Drizzle ORM 0.45.x + drizzle-kit 0.31.x | Prisma 7 (heavier, adapter ceremony); Kysely (no migrations/diffing) |
| Driver | `@neondatabase/serverless` Pool (WebSocket) via `drizzle-orm/neon-serverless` — interactive transactions | neon-http only (no interactive transactions) |
| Local dev + tests DB | PGlite (in-process Postgres) via `drizzle-orm/pglite` | Docker Postgres (extra setup); shared Neon dev branch for tests (network, flaky) |
| Auth | Hand-rolled DB sessions | Auth.js v5 (owner's original constraint; still beta, maintenance-only); Better Auth (lockout, must-change and branch scope stay custom anyway) |
| Hashing | `@node-rs/argon2` argon2id m=19456 KiB, t=2, p=1 | `@noble/hashes` (fallback only: slower, blocks event loop) |
| Transport | One JSON RPC route handler per repo method (POST) | Server Actions (client serialises calls: polling would queue behind saves); one REST route per endpoint (many shared route files) |
| Scheduler | Vercel Cron, `vercel.json` | GitHub Actions schedule (extra account/secret) |
| Rate limits | Postgres tables | Upstash Redis (extra account) |

### §15.2 Folder structure (new / changed)
```
src/proxy.ts                               §18.5
src/app/api/rpc/[repo]/[method]/route.ts   §17.3 (only data door)
src/app/api/cron/daily/route.ts            §25
src/app/{account,privacy}/ admin/{branches,branches/[id],advisors,customers}/   new pages (thin)
src/features/{account,admin-branches,admin-customers,privacy}/                  new feature folders
src/server/                                server-only (`import "server-only"` in every file)
  env.ts  log.ts  ctx.ts  scope.ts  audit.ts  tokens.ts  rateLimit.ts  erasure.ts
  db/client.ts  db/schema/<table>.ts  db/schema/index.ts
  auth/{password,session,cookies,stepUp}.ts
  repos/<name>.ts            Server<Name>Repo, one file per §2 repo
  rpc/<name>.ts  rpc/index.ts   method table per repo; index lists them (frozen)
  createServerDataAccess.ts  server composition root
  jobs/cleanup.ts
src/data/remote/{createRemoteDataAccess,rpcClient,activity,poller}.ts   client side
src/domain/ + roles.ts jobCardInput.ts models.ts passwordPolicy.ts retention.ts erasure.ts
drizzle/0000_init.sql  drizzle/meta/**  drizzle.config.ts   scripts/{admin,migrate,golive-check}.ts   vercel.json
tests/unit/server/<area>/  tests/support/{pglite,serverCtx}.ts
```

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

### §15.5 Env vars (`src/config/env.ts` public · `src/server/env.ts` server-only; both zod; `.env.example` documents all)
| Key | Side | Required | Example | Use |
|---|---|---|---|---|
| `DATABASE_URL` | server | yes | `postgresql://…-pooler…/psf?sslmode=require` · local `pglite:./.pglite` | app connection (pooled) |
| `DATABASE_URL_UNPOOLED` | scripts | migrate/admin | `postgresql://…/psf` | migrations, maintainer scripts |
| `CRON_SECRET` | server | yes (prod) | 32+ random chars | §25 bearer |
| `IP_HASH_PEPPER` | server | yes (prod) | 32 random bytes b64 | HMAC of client IP in limit tables |
| `APP_URL` | server | yes (prod) | `https://chandra-psf-prod.vercel.app` | base of `/f/<code>` links (custom domain later = change this) |
| `NEXT_PUBLIC_POLL_SECONDS` | public | no (30) | `30` | §20 cadence |
| `NEXT_PUBLIC_COMPANY_NAME` · `_PRIVACY_PHONE` · `_PRIVACY_EMAIL` · `_DEALER_PHONE` | public | yes | placeholders until gate | notice, `/privacy`, link-state pages |
| ~~`NEXT_PUBLIC_DEMO_PASSWORD`~~, ~~`NEXT_PUBLIC_APP_URL`~~ | — | removed | — | §27; links now built on the server |
Non-production fallback (§0.5) kept for public keys; server keys have **no** fallback except `DATABASE_URL` → `pglite:memory` in tests.

## §16 Database
- **Paths:** `src/server/db/schema/<table>.ts` (one table per file, frozen after foundation), `src/server/db/client.ts`, `drizzle.config.ts`, `drizzle/`.
- **Client:** `type Db = PgDatabase<PgQueryResultHKT, typeof schema>`; `getDb(): Db` per request: `DATABASE_URL` starting `pglite:` → PGlite (dir or memory, dynamic import, never in production: `env.ts` rejects `pglite:` when `VERCEL_ENV=production`), else `new Pool({ connectionString })` + `drizzle(pool)`; pool closed with `after(() => pool.end())`. `withTx(db, fn)` = `db.transaction(fn)`.
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
| `audit_log` | id bigserial, at, actor_id null (null = system), actor_name, branch_id null, action text, entity_type, entity_id, old_value jsonb, new_value jsonb, note | idx (branch_id, id desc), (action, id desc); trigger: no DELETE; UPDATE only of old/new/note when `current_setting('psf.redact', true) = 'on'` (§24) |
| `erasure_journal` | job_card_id, erased_at, source `('request','retention')` | PK (job_card_id); no personal data |
Answers are one `jsonb` per response (not one row per answer): analytics loads whole responses; `toAnswerRows` (§1.1) stays unused. Diagram: `.results/lld/schema-phase2.mmd`.

### §16.2 Migrations
- `drizzle-kit generate` → `drizzle/NNNN_<name>.sql` + `drizzle/meta/_journal.json` (shared file: **migrations are serial**, never two tasks at once). The foundation writes the whole schema as `0000_init.sql` plus hand-added SQL for the audit trigger and partial index.
- Applied by `scripts/migrate.ts` (`drizzle-orm/neon-serverless/migrator`, `DATABASE_URL_UNPOOLED`): Vercel build command `pnpm db:migrate && next build` (Preview → Neon `dev` branch, Production → `main`). Forward-only, additive first (expand → deploy → contract).

## §17 Server data access

### §17.1 Shape
Server repos implement the **same §2 interfaces** (amended in §17.2): `class Server<Name>Repo implements <Name>Repo { constructor(private ctx: RequestCtx) }`. `RequestCtx { db: Db; clock: Clock; session: SessionInfo | null; scope: Scope | null; ip: string; cookies: SessionCookies; log: Logger }` (`ctx.ts`). Same §2.1 rules: async, never throw (`guard(fn)` in `ctx.ts` maps exceptions → `SAVE_FAILED`/`UNAVAILABLE` and logs the error class only), role + branch checks inside. `createServerDataAccess(ctx): Omit<DataAccess, 'subscribe'>`. Domain §1 functions are reused unchanged (`validateSubmission`, `evaluateAlertReasons`, `reconcileAlert`, `computeOverview`, `visitStatus`, `buildWhatsAppUrl`).

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

### §17.3 RPC transport
- **Client** (`src/data/remote/`): `createRemoteDataAccess({ fetch, activity, poller }): DataAccess` builds each repo as a `Proxy` whose any method `m` calls `rpc(repo, m, args)`; `rpcClient.ts` `rpc()` → `POST /api/rpc/<repo>/<m>` body `{ args }`, headers `content-type: application/json`, `x-psf-active: 1|0` (§20); network failure → `SAVE_FAILED`/`UNAVAILABLE` per the method kind; response is the `Result` JSON. `UNAUTHENTICATED` on a staff page → `invalidate(SESSION_KEY)` → `RoleGuard` → `/sign-in?next=<path>&ended=1` ("Your session has ended. Sign in again.").
- **Registry** (`src/server/rpc/<repo>.ts`, one per repo): `export const visitsRpc = { listVisits: { kind: 'read', access: 'staff', input: z.tuple([...]) }, … } satisfies RpcTable<VisitRepo>`; `rpc/index.ts` maps repo name → table (frozen). `access: 'public'` only for `auth.signIn`, `auth.currentUser`, `feedback.*`.
- **Route** `POST /api/rpc/[repo]/[method]` (`runtime` default Node; `dynamic = 'force-dynamic'`): (1) `Origin` host must equal request host (else 403) and content-type JSON; (2) look up table entry (unknown → 404); (3) zod-parse args (→ `VALIDATION`); (4) per-IP flood limit 300/h on public methods; (5) `ctx = await buildCtx(request)` reads the session (§18.2), touches it when `kind === 'write'` or `x-psf-active: 1`; staff method without session → `UNAUTHENTICATED` (HTTP 200 with Result; 401 status for logs); (6) `createServerDataAccess(ctx)[repo][method](...args)`; (7) `Cache-Control: no-store`. Always HTTP 200 with a `Result` except 403/404 above.

## §18 Auth & sessions
- **Paths:** `src/server/auth/{password,session,cookies,stepUp}.ts`, `src/server/repos/auth.ts`, `src/proxy.ts`; screens §7 (+ `src/features/account/` My account, change password).

### §18.1 Passwords (`password.ts`)
`hashPassword(pw): Promise<string>` (argon2id, m 19456, t 2, p 1; raise if p95 < 100 ms measured in M3), `verifyPassword(hash, pw): Promise<boolean>`, `DUMMY_HASH` verified for unknown emails (equal timing). Policy in domain `passwordPolicy.ts`: `passwordProblem(pw): 'too_short' | 'too_common' | null` (≥ 8 chars, not in an embedded top-1000 list, case-insensitive). Temporary/one-time passwords follow the same policy; `scripts/admin.ts` generates 16-char random ones.

### §18.2 Sessions (`session.ts`, `cookies.ts`)
| Item | Rule |
|---|---|
| Token | 32 random bytes base64url in cookie `__Host-psf_session` (prod) / `psf_session` (dev): httpOnly, Secure (prod), SameSite=Lax, Path=/, Max-Age 7 d |
| Store | `sessions.id_hash = sha256(token)`; raw token never stored or logged |
| Valid when | user active, branch active (non-main), `now < last_active_at + idle(role)` (support 2 h, admins 12 h), `now < created_at + 7 d` |
| Touch | `last_active_at = now` when the request is a write or flagged active, at most once per 60 s |
| End | sign-out (this session); deactivate, reset password, role/branch change (all of that user's); change own password (all others) |
| API | `createSession(ctx, userId)`, `readSession(ctx): SessionInfo \| null` (`{ sessionId; user: StoredUser }`), `touchSession`, `endSession`, `endUserSessions(tx, userId, exceptId?)` |
`SessionCookies` interface (`get/set/clear`) is implemented on `next/headers` `cookies()` in the route and by a fake in tests.

### §18.3 Sign-in sequence (`ServerAuthRepo.signIn`)
1. `emailKey = lower(trim(email))`; IP failures (kind signin) in last 15 min ≥ 30 → `RATE_LIMITED`. 2. Email failures in last 15 min ≥ 5 → `RATE_LIMITED` "Too many attempts. Try again in 15 minutes." (audit `auth.lockout` once, on the 5th failure). 3. Load user; verify against hash or `DUMMY_HASH`. 4. Wrong / unknown → insert attempt, `BAD_CREDENTIALS`. 5. Inactive user or inactive branch → `ACCOUNT_DISABLED`. 6. `otp_expires_at < now` → `OTP_EXPIRED`. 7. `createSession`, `last_sign_in_at`, audit `auth.sign_in`, return `User` (`mustSetPassword` → `/set-password`). An admin reset deletes that email's attempts (clears the lock).

### §18.4 Step-up (`stepUp.ts`)
`verifyStepUp(ctx, s): Promise<Result<void>>`: wrong → insert attempt kind stepup + `BAD_PASSWORD`; 5 in 15 min → `endUserSessions` + `UNAUTHENTICATED`. Used by response edit/delete/restore and customer erase.

### §18.5 Proxy (`src/proxy.ts`, Next 16: renamed middleware, Node runtime, no `runtime` export)
`export function proxy(req)`: matcher `['/admin/:path*', '/support/:path*', '/account', '/set-password']`; no session cookie → redirect `/sign-in?next=<path>`. Never reads the DB (runs on prefetches); not a security boundary: every RPC re-verifies (§17.3). `/f/*`, `/privacy`, `/api/*` are outside the matcher. Security headers in `next.config.ts`: `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Permissions-Policy` minimal; `robots` noindex kept.

## §19 Scope & roles (`src/server/scope.ts`, domain `roles.ts`)
```ts
type Scope = { kind: 'all' } | { kind: 'branch'; branchId: string };
scopeOf(user): Scope;                                    // main_admin → all
requireStaff(ctx) / requireAdmin(ctx) / requireMainAdmin(ctx): Result<SessionInfo>   // UNAUTHENTICATED | FORBIDDEN
branchFilter(col, scope, wanted?: string): SQL | undefined   // wanted only honoured for 'all'; branch scope ignores it
inScope(scope, branchId): boolean                        // single-row checks → else NOT_FOUND
```
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
- `providers.tsx`: QueryClient `refetchOnWindowFocus: false` (the poller owns refresh); the form query uses `staleTime: Infinity` so it never re-counts as an open.

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

## §23 Branches, advisors, users (server repos `branches.ts`, `advisors.ts`, `users.ts`; screens `src/features/admin-branches/`, `admin-users/` (§14 extended))
```ts
interface BranchRepo { listBranches(): Result<(Branch & { staffCount: number })[]>;          // scope (§19)
  createBranch(i: { name; city }): Result<Branch>;  updateBranch(id, p: { name?; city? }): Result<Branch>;   // NAME_IN_USE "A branch with this name already exists"
  setBranchActive(id, active): Result<Branch> }     // main admin only; deactivating ends its staff's sessions
interface AdvisorRepo { listAdvisors(f: { branchId?: string; activeOnly?: boolean }): Result<(Advisor & { branchName })[]>;
  createAdvisor(i: { branchId; name }): Result<Advisor>; renameAdvisor(id, name): Result<Advisor>; setAdvisorActive(id, active): Result<Advisor> }
interface UserRepo { listUsers(f?: { branchId? }): Result<User[]>;
  createUser(i: { name; email; role: Role; branchId: string | null; tempPassword }): Result<User>;  // VALIDATION, EMAIL_IN_USE, FORBIDDEN (role/branch outside caller's rights), VALIDATION "Add a branch first"
  updateUser(id, p: { name?; email?; role?; branchId? }): Result<User>;   // G-9 rights; role/branch change ends sessions
  setUserActive(id, active): Result<User>;  resetPassword(id, tempPassword): Result<void> }   // reset: must_set_password, end sessions, clear email attempts; audit without the password
```
Guards in one function `assertCanManage(actor, target, change)`: nobody changes own role/branch/active; the last active main admin cannot be deactivated or demoted (`CONFLICT`); branch admin: only support users of own branch, fields name/email/active/reset; main admin resets anyone but self (self uses Change password). Every change audited with old → new (password fields never).

## §24 Customers & erasure (`repos/customers.ts`, `src/server/erasure.ts`, domain `erasure.ts`)
```ts
interface CustomerRow { jobCardId; branchName; serviceDate; customerName: string | null; regNo: string | null; linkStatus: VisitStatus | null; hasResponse: boolean; erased: boolean }
interface CustomerRepo { searchCustomers(q: { phone?: string; regNo?: string }): Result<CustomerRow[]>;   // main admin; by phone_key / reg_no_key across branches
  exportCustomers(jobCardIds: string[]): Result<{ filename: string; csv: string }>;   // audit customer.export {count}
  eraseCustomers(jobCardIds: string[], s: StepUp): Result<{ erased: number }> }       // step-up; audit customer.erase {count}
```
- `eraseJobCards(tx, ids, source, now)` (shared with §25): job card name/phone/reg no (+ keys) → null, `erased_at`; each response (incl. deleted) `answers = stripFreeText(answers)` (domain: drops Q14, Q2a, Q13a and every `.text`); alert notes text → "[erased]"; `SET LOCAL psf.redact = 'on'` then audit rows of those job cards/visits/responses/alerts get `old_value`/`new_value` → `"[erased]"` where they held personal fields; insert `erasure_journal`; after commit `log.event('erasure', { source, jobCardIds })` (ids only). Links stop working via §21 (`erased_at`).
- CSV: hand-written RFC 4180 writer (`src/server/csv.ts`), UTF-8 BOM for Excel, columns: branch, job card, service date, name, phone, reg. no, model, link status, submitted at, each question code. Values starting `= + - @` prefixed with `'` (formula injection).

## §25 Daily cron (`src/app/api/cron/daily/route.ts`, `src/server/jobs/cleanup.ts`, `vercel.json`)
- `vercel.json`: `{ "crons": [{ "path": "/api/cron/daily", "schedule": "30 21 * * *" }] }` (03:00 IST; Hobby runs within that hour). `GET` only; `Authorization` must equal `Bearer ${CRON_SECRET}` (`timingSafeEqual`) else 401; `maxDuration = 300`.
- `runDailyCleanup(db, clock): Promise<CleanupCounts>`; each step loops in batches of 500 until done or 240 s elapsed (next run continues; all steps idempotent):
| Step | Rule (domain `retention.ts` cut-offs, IST dates) |
|---|---|
| unanswered | job cards not erased, no visit with `completed_at`, `service_date < today − 90 d` → `eraseJobCards(…, 'retention')` |
| answered | job cards not erased with a completed visit, `service_date < today − 3 y` → erase |
| purge deleted | responses `deleted_at < now − 30 d` → delete alert + response; audit `response.purge` per row (no answers) |
| sessions | expired by §18.2 rules → delete |
| attempts, limits | `login_attempts.at`, `rate_limits.window_start` older than 24 h → delete |
| summary | one audit `system.cleanup` (actor null, name "System") with counts |

## §26 Setup, migrations, backup & restore
- **`scripts/admin.ts`** (tsx, `DATABASE_URL_UNPOOLED`): `init --name --email` → refuses ("Users already exist; nothing changed") if any user; installs questionnaire v1 (idempotent); creates `main_admin` with a printed 16-char one-time password, `must_set_password`, `otp_expires_at = now + 72 h`; audit actor system. `reissue --email` → new one-time password + 72 h (only for users still `must_set_password`); `recover --email --no-admin-can-sign-in` → only for an existing `main_admin` (the flag records that the maintainer checked no main admin can sign in, G-14): sets a one-time password, 72 h, clears that email's attempts, ends sessions; both audited `user.otp_reissue` / `user.recover` actor system. `scripts/golive-check.ts` fails on placeholder env values.
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
