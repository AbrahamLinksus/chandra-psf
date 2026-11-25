# Low-level design — phase 2 (production) · §15–§27

> Continues `docs/LLD.md` (phase-1 §0–§14 keep their numbers). Same rules: numbered self-contained sections, stable numbers, one fact in one place. System view: `docs/HLD.md`. Product rules: `docs/SPEC.md`. Diagrams: `.results/lld/dataflow-phase2.mmd`, `.results/lld/schema-phase2.mmd`. Cap: 400 lines.
> As-built sync: **M3** (2026-11-24), **M4** (2026-11-24), **M5** (2026-11-25, code since `37a3695`), **M6** (2026-11-26, CR-2 questionnaire v2 + D-47 Overview, §17.6). Sections tagged "(as-built M3/M4/M5/M6)" match the merged code; untagged parts (§27) are design only.
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

Milestones (HLD): **M3** §15–§19, §23, §26 setup · **M4** §20–§22 + §8/§9 screens (+ §11 alerts server, §17.4) · **M5** §24, §25, scoped §10, §12–§14 screens, §26 restore, §27.

### §15.1 Stack additions (as-built M3)
| Concern | Choice | Rejected alternative (why) |
|---|---|---|
| Hosting region | Vercel functions in `sin1` (`vercel.json` `regions`), next to Neon Singapore (D-28). M3 also turned Git deploys of `main` off in `vercel.json`; **as-built M5** the file holds only `buildCommand`, `regions`, `crons` (§25): the `git` key is gone, so automatic `main` deploys are governed by the Vercel project settings | default `iad1` (3–4.5 s sign-in on preview: every query crossed oceans) |
| ORM / migrations | Drizzle ORM 0.45.x + drizzle-kit 0.31.x | Prisma 7 (heavier, adapter ceremony); Kysely (no migrations/diffing) |
| Driver | `@neondatabase/serverless` Pool (WebSocket) via `drizzle-orm/neon-serverless` — interactive transactions | neon-http only (no interactive transactions) |
| Local dev + tests DB | PGlite (in-process Postgres) via `drizzle-orm/pglite` | Docker Postgres (extra setup); shared Neon dev branch for tests (network, flaky) |
| Auth | Hand-rolled DB sessions | Auth.js v5 (owner's original constraint; still beta, maintenance-only); Better Auth (lockout, must-change and branch scope stay custom anyway) |
| Hashing | `@node-rs/argon2` argon2id m=19456 KiB, t=8, p=1 (§18.1, D-29) | `@noble/hashes` (fallback only: slower, blocks event loop) |
| Transport | One JSON RPC route handler per repo method (POST) | Server Actions (client serialises calls: polling would queue behind saves); one REST route per endpoint (many shared route files) |
| Scheduler | Vercel Cron, `vercel.json` | GitHub Actions schedule (extra account/secret) |
| Rate limits | Postgres tables | Upstash Redis (extra account) |

### §15.2 Folder structure (new / changed) (as-built M5)
```
src/proxy.ts                               §18.5 (auth redirect + CSP)
src/app/api/rpc/[repo]/[method]/route.ts   §17.3 (only data door; calls handleRpc)
src/app/api/cron/daily/route.ts            §25
src/app/account/ admin/{branches,branches/[id],advisors,customers}/ privacy/   new pages (thin); f/[token]/, support/{,new}/ keep phase-1 paths
src/features/{account,admin-branches,admin-alerts,admin-audit,admin-customers,admin-overview,admin-responses,support,feedback-form,privacy}/   built or rebuilt
src/server/                                server-only (`import "server-only"`; exemptions below)
  env.ts  log.ts  ctx.ts  scope.ts  audit.ts  rateLimit.ts  tokens.ts  erasure.ts  csv.ts
  db/client.ts  db/schema/<table>.ts  db/schema/{index,enums,bytea}.ts
  auth/{password,session,cookies,stepUp}.ts
  repos/<name>.ts            Server<Name>Repo, one file per §2 repo (+ helpers userRules.ts §23, jobCardRules.ts §22, visitRows.ts §21, unavailable.ts stub)
  rpc/<name>.ts  rpc/index.ts   method table per repo; index lists them (frozen)
  rpc/{handler,context,args,types}.ts   transport core (§17.3)
  createServerDataAccess.ts  server composition root
  jobs/cleanup.ts
src/data/remote/{createRemoteDataAccess,rpcClient,activity,poller}.ts   client side (§17.3, §20)
src/lib/signInUrl.ts                       safeNext / signInUrl (shared by RoleGuard + sign-in)
src/domain/ + roles.ts jobCardInput.ts models.ts passwordPolicy.ts commonPasswords.ts retention.ts erasure.ts
drizzle/0000_init.sql  drizzle/meta/**  drizzle.config.ts   scripts/{admin,adminClear,migrate,golive-check}.ts   vercel.json
tests/unit/server/<area>/  tests/support/{pglite,serverCtx,e2e,fakeDataAccess}.ts  tests/e2e/global-setup.ts
```
`server-only` exemptions (run under tsx scripts or shared with `proxy.ts`): `env.ts`, `auth/password.ts` (commented), `auth/cookies.ts`; `ctx.ts`, `scope.ts`, `auth/session.ts` and `repos/jobCardRules.ts` lack it without a comment (known minors T-17, T-03b). The planned `repos/linkAccess.ts` was folded into `repos/feedback.ts` (T-04b).

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

### §15.5 Env vars (as-built M5) (`src/config/env.ts` public: **plain checks, no zod** (D-34: zod's eval-style probe is blocked by the strict CSP on client pages; still the only `process.env` reader on the client side) · `src/server/env.ts` server-only, lazy `getServerEnv()`, zod; `.env.example` documents all)
| Key | Side | Required | Example | Use |
|---|---|---|---|---|
| `DATABASE_URL` | server | yes | `postgresql://…-pooler…/psf?sslmode=require` · local `pglite:./.pglite` | app connection (pooled) |
| `DATABASE_URL_UNPOOLED` | scripts | migrate/admin; as built also required at runtime when `VERCEL_ENV=production` (review m-8: to drop) | `postgresql://…/psf` | migrations, maintainer scripts |
| `CRON_SECRET` | server | yes (prod, 32+ chars) | 32+ random chars | §25 bearer; unset (dev) → the cron route answers 401 to everyone |
| `IP_HASH_PEPPER` | server | yes (prod, 32+ chars) | 32 random bytes b64 | HMAC of client IP in limit tables (unset in dev/tests → per-process random pepper) |
| `APP_URL` | server | yes (prod, must be `https://`) | `https://chandra-psf-prod.vercel.app` | base of `/f/<code>` links (`linkUrl`, §21; unset in dev/tests → `http://localhost:3000`). Server-only: the phase-1 public key `NEXT_PUBLIC_APP_URL` is gone (row below); docs still naming it are stale |
| `AUTH_HASH_TIMING` | server | no (off) | `1` | opt-in: `1` writes one `{"evt":"auth.hash_timing","op","ms"}` line to stderr per argon2 hash/verify (§18.1, D-29). Read live by `isHashTimingEnabled()` in `src/server/env.ts`, not part of the zod schema or the cache |
| `NEXT_PUBLIC_POLL_SECONDS` | public | no (30) | `30` | §20 cadence; exported as `POLL_SECONDS`: missing, empty, non-numeric or ≤ 0 → 30 (fractional values accepted: known minor T-22s) |
| `NEXT_PUBLIC_DEALER_PHONE` | public | yes (non-empty check; dev fallback) | `+91 44 0000 0000` | link-state pages, WhatsApp text |
| `NEXT_PUBLIC_COMPANY_NAME` · `_PRIVACY_PHONE` · `_PRIVACY_EMAIL` | public | no at runtime (unset/empty → placeholder, never throws); **must be real for go-live** | `.env.example` placeholders | notice, `/privacy`, link-state pages, read via `src/config/env.ts` `env` (D-37). Placeholders exported as `CONTACT_PLACEHOLDERS`; `scripts/golive-check.ts` fails while any key still equals one (§26). `src/features/{feedback-form,privacy}/contact.ts` re-export the `env` values (still two copies, known minor T-04b) |
| ~~`NEXT_PUBLIC_DEMO_PASSWORD`~~, ~~`NEXT_PUBLIC_APP_URL`~~ | — | removed | — | §27; links now built on the server |

Test-only key (deliberately not in the table above and not in `.env.example`): `PUBLIC_FLOOD_LIMIT_OVERRIDE`, server side, optional, set only by `playwright.config.ts` for the e2e server (default `100000` there, so suites are not throttled; a test can export a smaller value). A positive integer replaces the 300/h public flood limit (§17.3). `getPublicFloodLimitOverride()` in `src/server/env.ts` reads it live (not in the zod schema or cache) and never honours it when `VERCEL_ENV=production`, nor when `NODE_ENV=production` on a non-`pglite:` DB.

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
| `rate_limits` | bucket text, key bytea, window_start timestamptz, count int | PK (bucket, key, window_start). Buckets as built: `rpc_public` (key = HMAC of IP), `open` / `submit` (key = SHA-256 of the link code, §21) |
| `advisors` | id, branch_id, name, active, created_at | unique (branch_id, lower(name)) |
| `job_cards` | id, branch_id, job_card_no (display), job_card_key (normalised), customer_name null, phone null, phone_key null (10 digits), reg_no null, reg_no_key null, model, vehicle_type, service_type, service_date, advisor_id, created_by, create_request_id uuid null, created_at, updated_at, erased_at null | unique (branch_id, job_card_key); unique create_request_id; idx phone_key, reg_no_key, (branch_id, service_date) |
| `visits` | id, job_card_id, branch_id (copy for scope), created_by → users, created_at, expires_at, opened_at, completed_at, cancelled_at, replaced_by → visits null | idx (branch_id, created_at desc), job_card_id |
| `link_tokens` | token_hash bytea PK, visit_id, created_by, created_at, superseded_at null | idx visit_id; at most one live per visit (partial unique on visit_id where superseded_at is null) |
| `questionnaires` | version int PK, definition jsonb, installed_at | **as-built M6:** only v2 = `QUESTIONNAIRE_V2` (§17.6); v1 is no longer installed (`scripts/admin.ts init` installs v2; `clear-feedback` deletes v1, §26) |
| `responses` | id, visit_id unique, questions_version → questionnaires (always 2 since M6), answers jsonb (`AnswerMap`, zod on read/write), submission_id uuid, submitted_at, deleted_at null, updated_at, version | idx deleted_at |
| `alerts` | id, response_id unique cascade, branch_id, reasons jsonb, status `alert_status`, notes jsonb `[{at,by,text}]`, created_at, updated_at, version | idx (branch_id, status) |
| `audit_log` | id bigserial, at, actor_id null (null = system), actor_name, branch_id null, action text, entity_type, entity_id, old_value jsonb, new_value jsonb, note | idx (branch_id, id desc), (action, id desc); trigger `audit_log_guard`: no DELETE, no TRUNCATE; UPDATE only of old/new/note when `current_setting('psf.redact', true) = 'on'` (§24) |
| `erasure_journal` | job_card_id, erased_at, source `('request','retention')` | PK (job_card_id); no personal data |

Answers are one `jsonb` per response (not one row per answer): analytics loads whole responses; `toAnswerRows` (§1.1) stays unused. Diagram: `.results/lld/schema-phase2.mmd`.

### §16.2 Migrations
- `drizzle-kit generate` → `drizzle/NNNN_<name>.sql` + `drizzle/meta/_journal.json` (shared file: **migrations are serial**, never two tasks at once). The foundation writes the whole schema as `0000_init.sql` plus hand-added SQL for the audit trigger and partial index.
- Applied by `scripts/migrate.ts` (`drizzle-orm/neon-serverless/migrator`, `DATABASE_URL_UNPOOLED`; a `pglite:` URL uses the PGlite migrator instead, for local dev and e2e): Vercel build command `pnpm db:migrate && next build` (Preview → Neon `dev` branch, Production → `main`). Forward-only, additive first (expand → deploy → contract). M4, M5 and M6 added no migration (v2 is a `questionnaires` row, not a schema change).

## §17 Server data access

### §17.1 Shape (as-built M3)
Server repos implement the **same §2 interfaces** (amended in §17.2): `class Server<Name>Repo implements <Name>Repo { constructor(protected readonly ctx: RequestCtx) }`, methods as arrow properties `m: <Name>Repo['m'] = (…) => guard(this.ctx, '<repo>.<m>', kind, async () => …)`. `RequestCtx { db: Db; clock: Clock; session: SessionInfo | null; scope: Scope | null; ip: string; cookies: SessionCookies; log: Logger }`, `SessionInfo { sessionId /* hex of the stored SHA-256 */; user: SessionUser { id; name; email; role; branchId; mustSetPassword }; createdAt; lastActiveAt }`, `Scope` and `MethodKind = 'read' | 'write'` all live in `ctx.ts`. Same §2.1 rules: async, never throw (`guard(ctx, where, kind, fn)` in `ctx.ts` maps exceptions → `SAVE_FAILED` (write) / `UNAVAILABLE` (read) and logs the error class only), role + branch checks inside. `createServerDataAccess(ctx): Omit<DataAccess, 'subscribe'>`. Domain §1 functions are reused unchanged (`validateSubmission`, `evaluateAlertReasons`, `reconcileAlert`, `computeOverview`, `visitStatus`, `buildWhatsAppUrl`).

### §17.2 Contract changes (Tier 1; foundation edits the frozen §1/§2 files once)
| Where | Change |
|---|---|
| §1.1 `Role` | `'support' \| 'branch_admin' \| 'main_admin'`; `roles.ts`: `isAdmin(role)`, `isMainAdmin(role)` (replaces `role === 'admin'` in §6 `RoleGuard`, §7 `landingPath`, §8 `useLinkActions`) |
| §1.1 types | `User` + `branchId \| null`, `branchName \| null`, `lastSignInAt`; new `Branch { id; name; city; active; createdAt }`; `Advisor` + `branchId`, `active`; `JobCard` + `id`, `branchId`, `erasedAt`, `customerName/regNo: string \| null`, `phone` lives here; `Visit` − `token`, − `phone`, `jobCardNo` → `jobCardId`, + `branchId`; `Filters` + `branchId?`; `AuditEntry` + `branchId`, `actorId: string \| null`; `AlertView`/`ResponseDetail` + `branchName`, `version`. **As built M4:** domain `JobCard` and `Visit` (`src/domain/types.ts`) are still the phase-1 shapes; the new fields live on the access types (`JobCardView` + `id`, §22; `VisitSummary` + `jobCardId`, nullable `customerName`/`regNo`, §21); no `branchId`/`erasedAt` on `JobCard` yet. **Still open after M5:** erasure (§24) shipped without the alignment; server repos (`analytics.ts`, `customers.ts`) build phase-1-shaped `JobCard`/`Visit` values (job card id in `jobCardNo`, empty `token`) to reuse domain functions (D-38) |
| §1.1 `AuditAction` | + `auth.sign_in`, `auth.lockout`, `user.update`, `user.reset_password`, `user.change_password`, `user.otp_reissue`, `user.recover`, `jobcard.create`, `jobcard.update`, `link.resend`, `branch.create/update/deactivate/reactivate`, `advisor.create/update/deactivate/reactivate`, `customer.export`, `customer.erase`, `response.purge`, `system.cleanup` |
| §2.1 | `ErrorCode` + `RATE_LIMITED`, `OTP_EXPIRED`, `NAME_IN_USE`; `Topic` + `branches`, `advisors` |
| §2.2 `DataAccess` | − `demo`; + `branches: BranchRepo`, `advisors: AdvisorRepo` (§23), `customers: CustomerRepo` (§24) |
| §7 `AuthRepo` | − `signInAsDemo`; + `changePassword(current, next): Result<void>` (BAD_PASSWORD, VALIDATION); `signIn` + RATE_LIMITED, OTP_EXPIRED; `setOwnPassword` only while `mustSetPassword` |
| §8 | see §21, §22: `listMyVisits` → `listVisits`, link issue returns `LinkIssued`, + `resendLink`, job card create/update, − `listFreshJobCards`, `VisitSummary` − `url`/`whatsappUrl`/`isMine` → + `createdByName`, `mine`. **As built M4:** all done except `listFreshJobCards`, still in `JobCardRepo` and the registry as an `unavailable()` stub (known minor T-01b) |
| §9 `FeedbackRepo` | `submitResponse(token, answers, submissionId: string)`; FormContext unchanged (+ `rate_limited` state). **As built M4:** `submissionId?: string` is **optional** in `src/data/access/repos/feedback.ts` (only for old tests; the server then makes one up, no retry protection; RPC input = 2- or 3-tuple, third `z.uuid()`); known minor T-04b: make it required |
| §10 | `getFilterOptions(f?: { branchId? })` → + `branches: Branch[]` (main admin only), advisors carry branch name |
| §11 | `listAlerts({ status?, branchId? })`; `updateAlert(id, patch, version)` → CONFLICT "Someone else changed this alert. Reload to see the latest." **As built M4** (§17.4); `version` required, int ≥ 1 in the RPC |
| §12 | `editResponse(id, answers, version, s)` (CONFLICT); list/detail/deleted rows + `branchName`; `DeletedRow` + `purgeOn`; `listResponses(f: ResponseFilters = Filters & { branchId? })`. **As built M5** (§17.5) |
| §13 | `listAudit({ action?, branchId?, before?: string })` → `AuditPage { entries: AuditEntryView[]; nextCursor: string \| null }`, fixed page 100 (**no `limit` arg** as built); `AuditEntryView` keeps `action`/`entityType` as `string`, + `branchName`. **As built M5** (§17.5) |
| §14 | see §23 `UserRepo` |

### §17.3 RPC transport (as-built M3; client wiring M4; registry + flood override M5)
- **Client** (`src/data/remote/`): `createRemoteDataAccess({ fetch, activity, poller, onUnauthenticated }): DataAccess` builds each repo as a `Proxy` whose any method `m` calls `rpc(deps, repo, m, args)`; `rpcClient.ts` `rpc()` → `POST /api/rpc/<repo>/<m>` body `{ args }`, headers `content-type: application/json`, `x-psf-active: 1|0` (`activity.isActive()`, §20); network or parse failure → `SAVE_FAILED`/`UNAVAILABLE` per the method kind; response is the `Result` JSON. As built the client's kind comes from `kindOf(method)` (name starts `get|list|count|current` → read), not from the registry (known minor T-18). `UNAUTHENTICATED` → `onUnauthenticated` → `invalidateQueries(SESSION_KEY)` → `RoleGuard` → `signInUrl(path, ended)` = `/sign-in?ended=1&next=<path>` ("Your session has ended. Sign in again."; `safeNext` in `src/lib/signInUrl.ts` accepts only same-origin relative paths). Since M4 `providers.tsx` passes the real `createActivityTracker({ target: window })` and `createPoller({ activity, pollSeconds: POLL_SECONDS, doc: document, getPathname, hasStaffSession })` (§20); both are built only in the browser.
- **Registry** (`src/server/rpc/<repo>.ts`, one per repo; arg schemas in `rpc/args.ts`, `RpcEntry`/`RpcTable` in `rpc/types.ts`): `export const visitsRpc = { listVisits: { kind: 'read', access: 'staff', input: z.tuple([...]) }, … } satisfies RpcTable<VisitRepo>`; `rpc/index.ts` `rpcTables` maps repo name → table (frozen), `findRpcEntry(repo, method)` uses own-property lookups only. **`access: 'public'` as built:** `auth.signIn`, `auth.signOut`, `auth.currentUser`, `feedback.*` (`getVisitByToken`, `markOpened`, `submitResponse`). `signOut` is public on purpose (deviation from the design list): an ended or expired session must still be able to clear its cookie; it only deletes the caller's own session row. `signInAsDemo` is gone from `AuthRepo` and the registry (§27). Built repos: **M3** `auth`, `branches`, `advisors`, `users`; **M4** `jobCards` (§22), `visits` (§21), `feedback` (§21), `alerts` (§17.4); **M5** `analytics`, `responses`, `audit` (§17.5), `customers` (§24; `searchCustomers` is `read`, export/erase `write`, id arrays max 500). The only `unavailable()` stub left (`repos/unavailable.ts`, "Not available yet.") is `jobCards.listFreshJobCards` (known minor T-01b).
- **Route** `POST /api/rpc/[repo]/[method]` (`runtime` default Node; `dynamic = 'force-dynamic'`), entry point `handleRpc(request, { repo, method })` in `src/server/rpc/handler.ts`: (1) `Origin` host must equal request host (else 403) and content-type JSON; (2) look up table entry (unknown → 404); (3) zod-parse args (→ `VALIDATION`); (4) `base = await buildBaseCtx(request)` (`src/server/rpc/context.ts`; `ip = clientIp(headers)`: first `X-Forwarded-For` entry, else `x-real-ip`, else `"unknown"`, known minor T-18), then `ctx = await withSession(base, request, kind)` reads the session once (§18.2; no cookie → no DB hit) and touches it when `kind === 'write'` or `x-psf-active: 1`; (5) per-IP flood limit 300/h (`hitIpLimit`, `PUBLIC_FLOOD_BUCKET`, `PUBLIC_FLOOD_LIMIT_PER_HOUR` in `src/server/rateLimit.ts`) on public methods **only when `ctx.session` is null**: a valid staff session skips it (D-32, T-34s; staff sharing one branch connection never trip it); a forged, expired or ended cookie reads as no session and is counted (cost: one indexed session lookup); over the limit → `RATE_LIMITED` "Too many requests. Try again later."; `hitIpLimit(ctx, { bucket, limit, windowMs? = 1 h })` is a fixed-window upsert on `rate_limits` keyed by `hashIp(ip)` = HMAC-SHA256 with `IP_HASH_PEPPER`; for the `rpc_public` bucket only, `limit` is replaced by the E2E-only `PUBLIC_FLOOD_LIMIT_OVERRIDE` when honoured (§15.5; any error reading it → the given limit); (6) staff method without session → `UNAUTHENTICATED` "Your session has ended. Sign in again." (HTTP 200 with Result); (7) `createServerDataAccess(ctx)[repo][method](...args)` (method missing on the repo → `UNAVAILABLE`); steps 4–7 are wrapped in `guard` (§17.1); (8) `Cache-Control: no-store`. Always HTTP 200 with a `Result` except 403/404 above.

### §17.4 Alerts repo (server side of §11: `repos/alerts.ts`, `rpc/alerts.ts`) (as-built M4)
```ts
interface AlertView extends Alert { customerName; phone: string | null; model; regNo; reasonsText; branchName: string; version: number }
interface AlertRepo { listAlerts(f?: { status?: AlertStatus; branchId?: string }): Result<AlertView[]>;  countOpen(): Result<number>;
  updateAlert(id, patch: { status?: AlertStatus; note?: string }, version: number): Result<AlertView> }
```
- All methods `requireAdmin` (support → FORBIDDEN) and scope by `branchFilter(alerts.branch_id, scope, f.branchId)`: `branchId` narrows only for the main admin; a branch admin always gets their own branch. Alerts of deleted responses are excluded everywhere.
- `listAlerts`: newest first, optional `status`; at most `LIST_LIMIT` 500 newest (silent truncation; known minor T-07b: move to `src/domain/constants.ts`, page or say "showing 500 newest"). `countOpen`: open alerts in scope.
- Erased customer (`job_cards.erased_at` set) or null name → `customerName` "Erased customer", `phone` null, `regNo` "", `notes` [].
- `updateAlert`: no status and blank note → VALIDATION "Choose a new status or type a note."; not a UUID, not found, out of scope or deleted response → NOT_FOUND "That alert no longer exists."; in one transaction: `version` ≠ stored → CONFLICT "Someone else changed this alert. Reload to see the latest."; same status and no note → ok, no write; else `UPDATE alerts SET status, notes (+ {at, by: user name, text}), updated_at, version = version + 1 WHERE id = ? AND version = <read>` (0 rows → the same CONFLICT); audit on the alert's branch: `alert.status` (`old {status}` → `new {status}`, with the note) when the status moved, else `alert.note` (note only). No row lock on the response (known minor T-07b).
- Screen `src/features/admin-alerts/` (§11): `AlertBranchFilter` (main admin's branch choice), `useAlertEditor` sends the row's `version` and, after CONFLICT, refetches while keeping the typed note.

### §17.5 Analytics, responses, audit repos (server side of §10, §12, §13: `repos/{analytics,responses,audit}.ts`, `rpc/` same names) (as-built M5)
All methods `requireAdmin` (support → FORBIDDEN), scope via `branchFilter(…, scopeOf(user), f.branchId)` (§19: `branchId` narrows only for the main admin).
| Method | As built |
|---|---|
| `analytics.getAnalytics(f)` | loads visits + live responses by `job_cards.service_date` from `previousPeriod(f).from` to `f.to` (for the trend arrows), plus open alerts of live responses; maps rows to phase-1 `JobCard`/`Visit` **without** name/phone/reg. no (§17.2) and returns `computeOverview(input, f, advisorNames, advisorBranches)` (**M6**: `advisorLabels` maps advisor id → name and → branch name in scope; blocks in §17.6). No `questions_version` filter: only v2 rows exist after `clear-feedback` (§26) |
| `analytics.getFilterOptions(f?)` | active advisors (by name), distinct models / vehicle types from job cards in scope; `branches` (all, by name) for the main admin only |
| `responses.listResponses(f)` | live responses, `service_date` between `f.from`/`f.to`, optional vehicleType / model / advisorId (non-UUID advisorId ignored); newest `submitted_at` first, **max 500** (local `LIST_LIMIT`, silent). M6: row field `q12` now carries the v2 overall rating **Q1** (name kept from v1; known minor) |
| `responses.getResponse(id)` | `ResponseDetail` (+ `branchName`, `version`); bad id, other branch, deleted → NOT_FOUND "Not found"; erased card → name "Erased customer", phone null, regNo "", alert notes [] |
| `responses.editResponse(id, answers, version, s)` | find → `validateSubmission` (missing → VALIDATION "Answer every question.", `fields`) → `verifyStepUp` (§18.4) → tx: re-find, `version` ≠ stored or 0 rows updated → CONFLICT "Someone else changed this. Reload to see the latest."; unchanged answers → no write; else `version + 1`, audit `response.edit` with only changed question codes old → new; re-run `evaluateAlertReasons` + `reconcileAlert`: created → insert + `alert.create`; auto-resolved → update + `alert.status`; other changes update silently |
| `responses.deleteResponse` / `restoreResponse(id, s)` | find in live / deleted → step-up → `deleted_at` = now / null, `version + 1` guarded by version (CONFLICT as above); audit `response.delete` / `response.restore` on the visit's branch |
| `responses.listDeleted()` | deleted, newest `deleted_at` first, max 500; `purgeOn = istDateOf(deletedAt) + DELETED_PURGE_DAYS` (30) |
| `audit.listAudit(f?)` | newest id first, `AUDIT_PAGE_SIZE` 100 (+1 to detect more); `before` = numeric id cursor (RPC: 1–15 digits); `action` exact match (RPC: ≤ 64 chars); left-joins `branchName`; system rows (actor null, name `SYSTEM_ACTOR`) shown as "System" |

Screens: `src/features/admin-overview/` (§10, as of M6 §17.6), `admin-responses/` (§12; `useResponseEditor`, `useDeleteResponse`, `DeletedScreen`), `admin-audit/` (§13; `useAuditPages` follows `nextCursor`, `AuditActionFilter`, `AuditBranchFilter`).

### §17.6 Questionnaire v2 and Overview v2 (CR-2, D-47) (as-built M6)
**Questionnaire** `QUESTIONNAIRE_V2` (`src/domain/questionnaire.ts`, `version: 2`; v1 constant removed) is the only set read by the form (`StepView`, `formMachine`, `draft.ts`), `visibility.ts`, metrics, `repos/{feedback,responses,customers}.ts`. Six steps, v1 titles: 1 Service Quality & Complaint Resolution · 2 Customer Interaction & Communication · 3 Timelines & Vehicle Delivery · 4 Pricing & Value for Money · 5 Overall Satisfaction & Loyalty · 6 Callback.
| Code (was v1) | Step | Type | Follow-up (`showIf`) |
|---|---|---|---|
| Q1 overall service (Q12) | 1 | rating_5 | Q1a concern list (`lte 2`) |
| Q2 complaints rectified (Q2) | 1 | yes_partial_no | Q2a required text (`in [Partially, No]`) |
| Q3 issues after delivery (Q3) | 1 | yes_no | Q3a issue-type list (`eq Yes`) |
| Q4 advisor behaviour (Q6) | 2 | rating_5 | Q4a concern list (`lte 2`) |
| Q5 delivered on time (Q7) | 3 | yes_no | Q5a single pick "How late…" (`eq No`) |
| Q6 good condition (Q9) | 3 | yes_no | Q6a concern list (`eq No`) |
| Q7 charges explained (Q10) | 4 | yes_no | — |
| Q8 charges affordable (Q11) | 4 | rating_5 | Q8a expensive-component list (`lte 2`) |
| Q9 recommend (Q13) | 5 | yes_no | Q9a single pick primary reason (`in [Yes, No]`) |
| Q10 callback (Q15) | 6 | yes_no | Q10a single pick `CALLBACK_SLOTS` Morning/Afternoon/Evening (`eq Yes`) |

Concern lists are `multi_select_text` (≥ 1 chip + optional text, `TEXT_MAX_LENGTH`); wording and options verbatim from SPEC F-3. **Alerts** (`alertRules.ts`): callback reason first (with `Q10a` slot, `slotLabel` "Evening 3 PM–6 PM"), then Q1/Q4/Q8 = 1. **Submit** (§21) answers `{ callbackRequested, callbackSlot? }`; `ThankYouView` "Our team will call you: <slot>" (or "… soon"). **Drafts** keyed `psf:draft:v2:<visitId>`; an unversioned v1 draft is deleted, never loaded.

**Overview** (`computeOverview` in `src/domain/metrics/overview.ts`; screen `AdminOverviewScreen` → `KpiTiles`, then `OverviewBlocks`: `TrendChart`, `CategoryScores`, `AdvisorTable`; whole block area → "No responses for these filters" when the period has no responses):
- **Tiles** (`KpiTiles`, labels in words, `data-label`): Avg overall satisfaction (avg Q1, 1 dp) · Recommend rate (% Q9 Yes) · Responses · Response rate · **Callbacks requested** (responses with Q10 = Yes; "—" with none) · Open alerts (no delta, ignores dates). Each of the first five has a delta vs the previous period (hidden when either side is null).
- **Trend** (`trend.ts`): avg Q1 and Q9 % per ISO week (≤ 90 days) or month; empty buckets null.
- **Categories** (`categories.ts` `buildCategories`, `CategoryScores`): steps 1–5, score = mean of every answered base-question score in the step across the responses (`scores.ts`: rating `(r−1)/4×100`; Yes 100 / No 0; Q2 Partially 50; Q3 reversed), 1 dp, shown whole "/ 100". Each row is a button (`aria-expanded`, starts collapsed) opening `QuestionBars`: per base question (by wording) answer counts (Rating 1–5, or Yes/Partially/No) and its option follow-up's counts merged under it (Q2a text has none).
- **Advisors** (`advisors.ts`, `AdvisorTable`): columns Advisor · Branch (main admin on all branches, own column) · Responses · Score · Avg advisor behaviour (Q4) · % on time (Q5) · Avg overall satisfaction (Q1); sortable (`advisorSort.ts`, nulls last), default Score high → low; cards with sort chips below `md`.
- **Advisor score** (`advisorScore.ts`): `ADVISOR_WEIGHTS` Q4 30 · Q1 20 · Q2 15 · Q7 10 · Q5 10 · Q6 10 · Q9 5. For each weighted code, `avg_q` = mean answer score (as above) over the advisor's responses that answered it; `score = round(Σ w·avg_q ÷ Σ w)` over codes with ≥ 1 answer (re-normalised, so an unanswered code does not pull it down); null ("—") under `ADVISOR_MIN_RESPONSES` 3 or with no weighted answer. Q3 and Q8 carry no weight.

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

- **All pages dynamic:** `src/app/layout.tsx` calls `await connection()` so Next can stamp the nonce on its scripts (no static/ISR/CDN pages; cost accepted, D-31). The layout's `beforeInteractive` script `csp-style-nonce` sets `window.__webpack_nonce__` from the first nonced script, for Radix scroll-lock `<style>` tags. `tests/e2e/foundation/csp.spec.ts` fails on any violation. Because no `'unsafe-eval'` is allowed in production, client-loaded modules must not use eval-style probes (why `src/config/env.ts` dropped zod, D-34).
- Static headers stay in `next.config.ts` (all paths): `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`; `robots` noindex in the layout metadata.

## §19 Scope & roles (`src/server/scope.ts`, domain `roles.ts`) (as-built M3; table as-built M4)
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
| job cards, visits, links | own branch; any link of the branch (D-35) | own branch | all branches (no support screens; allowed); **creating** a job card needs a branch → FORBIDDEN (§22, D-39) |
| analytics, alerts, responses, deleted, audit | FORBIDDEN | own branch | all + filter |
| users | FORBIDDEN | support users of own branch | all except self edit of role/branch |
| advisors | list own branch (active) | manage own branch | all |
| branches | own (read) | own (read) | manage |
| customers | FORBIDDEN | FORBIDDEN (G-4) | all |

Audit rows carry the branch of the entity; user/branch/advisor admin actions carry the target's branch.

## §20 Live refresh (`src/data/remote/activity.ts`, `poller.ts`) (as-built M4)
- `createActivityTracker({ target, now? }): ActivityTracker` listens `pointerdown`, `keydown`, `scroll` (passive) on `window`. `isActive(withinMs = ACTIVE_HEADER_MS 60 s)`: a real input within 60 s (page load does **not** count) → `x-psf-active: 1` on every RPC (§17.3), which lets the server touch the session (§18.2). `isInUse(withinMs = IDLE_MS 15 min)`: input, or page load, within 15 min. `onResume(listener)`: fires on the first input after > 15 min without one; returns an unsubscribe. `dispose()`.
- `createPoller({ activity, pollSeconds, doc, getPathname, hasStaffSession }): Poller { subscribe(listener) }` backs `DataAccess.subscribe`: the interval, the `visibilitychange` listener and the `onResume` hook start with the first subscriber and stop with the last. A tick, a visibility change or a resume emits all `STAFF_TOPICS` (`session, visits, responses, alerts, audit, users, branches, advisors`) only when `document.visibilityState === 'visible'`, `isInUse(15 min)`, the path is not `/f`, `/privacy`, `/sign-in` (or below them) and `hasStaffSession()` (in `providers.tsx`: the cached `SESSION_KEY` query is ok with a non-null user). `useLiveInvalidation` turns topics into query invalidations.
- Cadence `POLL_SECONDS` (`src/config/env.ts`, §15.5). Known minors T-22s: fractional seconds accepted; `DEFAULT_POLL_SECONDS` 30 is defined twice (`env.ts` private, `poller.ts` exported) instead of in `src/domain/constants.ts`.
- `providers.tsx`: QueryClient `retry: false`, `refetchOnWindowFocus: false` (the poller owns refresh). The public form's context is **not** a TanStack query with `staleTime: Infinity` as designed but a one-shot effect `useFormContext(token)` (`src/features/feedback-form/useFormContext.ts`) that never follows invalidation: same intent (one load, the thank-you screen stays after submit).

## §21 Links & public form (server: `repos/visits.ts` + `repos/visitRows.ts`, `repos/feedback.ts`, `tokens.ts`) (as-built M4)
```ts
interface LinkIssued { visit: VisitSummary; url: string; whatsappUrl: string | null }   // the only time the code leaves the server
interface VisitSummary { id; jobCardId; jobCardNo; customerName: string | null; regNo: string | null; model; serviceDate; phone: string | null;
  status: VisitStatus; createdAt; expiresAt; createdByName: string; mine: boolean }   // never the code, answers or ratings
interface VisitRepo { listVisits(q: { scope: 'mine' | 'branch'; search?: string }): Result<VisitSummary[]>;
  createVisitLink(i: { jobCardId: string }): Result<LinkIssued>;  resendLink(visitId): Result<LinkIssued>;
  regenerateLink(visitId): Result<LinkIssued>;  cancelLink(visitId): Result<VisitSummary> }
```
- `tokens.ts`: `newLinkCode(): { code /* 43-char base64url of 32 bytes */; hash: Buffer /* SHA-256 */ }`, `hashCode(code)`, `linkUrl(code)` = `APP_URL` (trailing `/` stripped) + `/f/<code>`. `visitRows.ts`: `loadRecords(ctx, where, limit)` (visit + card + creator name, newest first), `summaryOf`, `issuedOf` (+ `url`, `buildWhatsAppUrl`), `currentSummary(ctx, jobCardId, userId)` (§22), `LIST_LIMIT` 200.
- **Who (D-35, G-8):** every method `requireStaff` + branch scope (outside → NOT_FOUND); **any** staff user of the link's branch may resend, regenerate or cancel any link, not only its creator (the client no longer has `canManage`); the main admin acts on all branches. Link writes on one job card serialise on `pg_advisory_xact_lock(hashtext('link:<jobCardId>'))` (resend/regenerate/cancel read the visit, take the lock, re-read).

| Method | Rules in order (messages verbatim) | Audit (entity `visit`, its branch) |
|---|---|---|
| `listVisits` | current links only (`replaced_by` null); `mine` = created by me, `branch` = my branch (main admin: all); `search` → alnum upper-case `LIKE` on `job_card_key` / `reg_no_key`; newest first, max 200 | — |
| `createVisitLink` | not a UUID / missing / out of scope → NOT_FOUND "That job card no longer exists."; erased → VALIDATION "This customer's data has been erased."; (lock) any completed visit → ALREADY_COMPLETED "Feedback already received"; a current, not cancelled visit (even expired: use Regenerate, D-39) → CONFLICT "A feedback link already exists for this job card."; else new visit, `expires_at = now + LINK_EXPIRY_DAYS` (7 d); a cancelled current visit gets `replaced_by` = new; new code | `link.create` |
| `resendLink` | NOT_FOUND "That link no longer exists."; completed, cancelled or replaced → CONFLICT "This link can no longer be changed"; erased → VALIDATION (as above, D-35); past expiry → CONFLICT "This link has expired. Regenerate it instead."; new code, same visit and expiry, old codes superseded | `link.resend` |
| `regenerateLink` | as resend, expired allowed; new visit 7 d, `old.replaced_by` = new, old codes superseded, new code | `link.regenerate` on the new visit, `new {replaced: oldId}` |
| `cancelLink` | NOT_FOUND / CONFLICT as resend (no erased check); `cancelled_at = now`, codes superseded | `link.cancel` |

- **Staff client** (§8 screens, `src/features/support/`): Generate = `useNewLink` `generateFn` saves a corrected phone with `updateJobCard` (audited `jobcard.update`) when the card is editable, then `createVisitLink`; CONFLICT → re-lookup. My links / All branch links = `useMyLinks` scope toggle → `listVisits({ scope, search })`. `useLinkActions(visit, issued, onCancelled)` (T-03d): a ref guard runs one action at a time (a fast second tap is dropped), `busy` disables the buttons, `retry` re-runs the last failed action; the URL is held in memory only after generate/resend/regenerate, so Copy works only then (known minor T-03c: expired or no-phone link shows no copy).
- **Public form** (`repos/feedback.ts`; the planned `linkAccess.ts` helpers are folded in). Per-link limits: `hitLinkLimit(ctx, 'open' | 'submit', code, limit)` = fixed 1 h window on `rate_limits` keyed by `hashCode(code)`; local constants `OPEN_LIMIT_PER_HOUR` 30, `SUBMIT_LIMIT_PER_HOUR` 5 (known minor T-04b: move to `src/domain/constants.ts`; duplicates `hitIpLimit`). All three methods are `public`, so the per-IP flood limit 300/h (§17.3) also applies without a staff session. `resolveLink(code)`: no token → invalid; visit cancelled or card erased → invalid; completed → completed; token superseded or visit replaced → expired (replaced); past `expires_at` → expired; else ready.
- `getVisitByToken(code)`: unknown code → `{ state: 'invalid' }` **without** a counter row; open limit hit → `{ state: 'rate_limited' }`; else the resolved state; ready → `{ visitId, customerName, model, regNo, serviceDate, questionnaire: QUESTIONNAIRE_V2 }` (M6, §17.6). Page `/f/[token]` → `FeedbackFormScreen` → `LinkStateScreen`: replaced "A newer link was sent to you on WhatsApp", expired "This feedback link has expired. Please contact Chandra Honda.", completed "Thank you — already submitted", rate_limited "Too many requests, try again in a few minutes" (+ Try again), invalid, error. Welcome screen shows `PrivacyNotice` → `/privacy`.
- `markOpened(code)`: called **only** by client JS (`useFeedbackFlow` effect once the form is ready), so link-preview robots never set Opened. Always ok (unknown or finished link = silent no-op); sets `opened_at = now` only for a live (not superseded) code whose visit is not opened, completed, cancelled, replaced or past expiry.
- `submitResponse(code, answers, submissionId?)`: unknown code → NOT_FOUND "Link not valid"; submit limit hit → RATE_LIMITED "Too many requests, try again in a few minutes"; `subId = submissionId ?? randomUUID()`; resolved completed → replay, invalid → NOT_FOUND, expired → CONFLICT "This feedback link has expired"; **M6:** `findStrayAnswers` first rejects unknown codes (e.g. v1 codes from an old tab) and answers to hidden follow-ups → VALIDATION "Some answers are not valid." (`fields` = those codes), so D-36's silent drop now only applies to staff edits (§17.5, `validateSubmission` → `pruneHidden`); missing visible answers → VALIDATION "Answer every question to submit." (`fields` = question codes). Then **one transaction** (the per-link limit and resolve run just before it, accepted D-39: the claim below is guarded): claim `UPDATE visits SET completed_at = now, opened_at = <read value> ?? now WHERE id = ? AND completed_at, cancelled_at, replaced_by IS NULL AND expires_at >= now RETURNING`; 0 rows → completed meanwhile → replay, else CONFLICT; insert `responses` (`questions_version` = `QUESTIONNAIRE_V2.version` 2, `submission_id`); `evaluateAlertReasons` + `reconcileAlert` → alert row + audit `alert.create` (actor System, visit's branch, `new {reasons}`). Replay: stored `submission_id` = `subId` → ok `callbackOf(answers)` = `{ callbackRequested: Q10 === 'Yes', callbackSlot?: Q10a }` (G-15; same shape as a first submit), else ALREADY_COMPLETED "Feedback already received". Client `draft.ts` `submissionIdFor(visitId)` keeps one UUID per visit in `localStorage` (`psf:submission:<visitId>`), reused by every retry; RATE_LIMITED shows its own message in `SaveState`.
- Known minors (T-04b): a racing `markOpened` can be overwritten by the claim's pre-read `opened_at`; small windows vs erasure/Resend during submit; `crypto.randomUUID` has no fallback; duplicate multi-select options not rejected.

## §22 Job cards (server: `repos/jobCards.ts` + `repos/jobCardRules.ts`; domain `jobCardInput.ts`, `models.ts`) (as-built M4)
```ts
interface JobCardView extends JobCard { id: string; advisorName: string; branchName: string; editable: boolean /* no completed visit, not erased */ }   // null name / reg. no → ""
interface JobCardInput { jobCardNo; customerName; phone: string | null; regNo; model; modelOther?; vehicleType?: 'scooter' | 'motorcycle' /* with "Other" */; serviceType; serviceDate; advisorId }   // raw; the server validates
interface JobCardRepo { getJobCard(jobCardNo): Result<{ jobCard: JobCardView; current: VisitSummary | null }>;
  createJobCard(i: JobCardInput & { requestId: string /* uuid */ }): Result<JobCardView>;
  updateJobCard(id, patch: Partial<JobCardInput>): Result<JobCardView>;
  listFreshJobCards(): Result<string[]> }   // phase-1 leftover, unavailable() (known minor T-01b: remove)
```
- `getJobCard`: `requireStaff`; key `normalizeJobCardNo(typed)`, not erased, in scope; none or empty key → NOT_FOUND "No job card <TYPED> at this branch yet"; `current` = `currentSummary` (the visit with `replaced_by` null, any status). Main admin: all branches; `limit(1)` picks one when numbers collide across branches (known minor T-03b).
- `createJobCard`: (1) a card already stored under this `requestId` **by this user** → that card (G-15); (2) branch = the session user's: none (main admin) → FORBIDDEN "You can't do that.", inactive → FORBIDDEN "Account disabled, contact admin"; (3) `parseInput` = `jobCardInputSchema(now)` (SPEC F-2 table; first issue's message, `fields` = issue paths); (4) advisors: none active in the branch → VALIDATION "Ask your admin to add advisors for this branch", chosen one not among them → VALIDATION "Pick an advisor" (`fields ['advisorId']`); (5) insert + audit `jobcard.create` `new {jobCardNo, model, serviceDate}`; unique violation → a parallel retry's card if the `requestId` matches (same user), else CONFLICT "<JC> already exists at this branch" `fields ['jobCardNo']` (also for a reused `requestId` from another user, accepted D-39). Main admin FORBIDDEN on create accepted (D-39).
- `updateJobCard`: missing, erased or out of scope → NOT_FOUND "That job card no longer exists."; a completed visit → CONFLICT "Feedback already received" (checked before, not inside, the update transaction: known minor T-03b); merge = stored card (`inputOf`) + patch, re-validated as a whole (an untouched old service date is kept; legacy null name/reg. no blocks edits: known minor T-03b); advisor re-checked only when patched; no changed column → current view, no audit; else update + audit `jobcard.update` old → new of changed columns only (`diffColumns`); unique violation → CONFLICT as create.
- Columns (`columnsOf`): `job_card_no` upper-case, `job_card_key` = `normalizeJobCardNo` (§1.5), `phone_key` = 10 national digits, `reg_no_key` = upper alnum, model "Other" stores `modelOther` with the chosen `vehicleType` (default scooter).
- Staff client (`src/features/support/`): `LookupBar` → `FoundCardSection` (phone edit, §21 Generate) or `MissingCard` → `JobCardForm` (`useJobCardForm`, one `requestId` per form) → the saved card is shown.

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
Audit actions as built: `branch.create/update/deactivate/reactivate`, `advisor.create/deactivate/reactivate` and **`advisor.rename`**, `user.create/update/deactivate/reactivate/reset_password`. **Open item (still open after M5):** `repos/advisors.ts` writes `advisor.rename`, but the `AuditAction` union (`src/domain/types.ts`, `schemas.ts`) and `src/features/admin-audit/auditFormat.ts` only know `advisor.update`; the audit screen (§17.5) shipped without aligning them, so `auditFormat.ts` has no label entry for rename rows (≈3 min; code unchanged by this sync). `isUniqueViolation(e)` (Postgres 23505 on the error or its cause) is exported from `repos/branches.ts` and imported by `advisors.ts`, `users.ts` and (M4) `jobCards.ts` (known minor: move to a db helper).
**Admin list refresh (T-32):** after a successful save the screen puts the saved row into the cached list at once, then refetches. `src/features/admin-branches/listCache.ts` `mergeBranch(queryClient, saved)` (key `BRANCHES_LIST_KEY = ['branches','list']`; keeps the row's `staffCount`, new row → 0) via `useRefreshingMutation(fn, merge?)`, which then invalidates `['branches']` and `['advisors']`; `src/features/admin-users/listCache.ts` `mergeUser(queryClient, saved)` (key `USERS_LIST_KEY = ['users','list']`) via `useUsersMutation`. Both replace by id or append, and leave an empty or failed cache alone.

## §24 Customers & erasure (`repos/customers.ts`, `src/server/erasure.ts`, `src/server/csv.ts`, domain `erasure.ts`) (as-built M5)
```ts
interface CustomerRow { jobCardId; branchName; serviceDate; customerName: string | null; regNo: string | null; linkStatus: VisitStatus | null; hasResponse: boolean; erased: boolean }
interface CustomerRepo { searchCustomers(q: { phone?: string; regNo?: string }): Result<CustomerRow[]>;   // all three: requireMainAdmin, others → FORBIDDEN
  exportCustomers(jobCardIds: string[]): Result<{ filename: string; csv: string }>;  eraseCustomers(jobCardIds: string[], s: StepUp): Result<{ erased: number }> }
```
| Method | As built |
|---|---|
| `searchCustomers` | phone wins over regNo: digits, last 10 → `phone_key` (< 10 digits → VALIDATION "Enter the full 10-digit number." `fields ['phone']`); else regNo without spaces, upper-case → `reg_no_key`; neither → VALIDATION "Enter a phone number or registration number."; **erased cards excluded** (so `erased` is always false); all branches, max 200, newest `service_date` first; `linkStatus`/`hasResponse` from the newest visit and its live response |
| `exportCustomers` | ids de-duplicated; none → VALIDATION "Tick at least one customer."; erased or unknown dropped, nothing left → NOT_FOUND "No customer found."; audit `customer.export` (entity `customer`/`export`, `new {count}`, branch null); `filename` `customers-<UTC yyyy-mm-dd>.csv` |
| `eraseCustomers` | same empty check → `verifyStepUp` (§18.4) → one tx: `eraseJobCards(…, 'request')`; erased ≥ 1 → audit `customer.erase` (`customer`/`erase`, `new {count}`, branch null); none erased (unknown or already erased) → NOT_FOUND "No customer found."; after commit `logErasure` |

- `eraseJobCards(tx, ids, source: ErasureSource /* 'request' | 'retention' */, now): Promise<string[]>` (shared with §25, §26): skips cards already erased; job card name/phone/reg no (+ keys) → null, `erased_at = now`; each response of the card's visits (incl. deleted) `answers = stripFreeText(answers)`; every alert note's `text` → `ERASED_MARK` "[erased]"; `set_config('psf.redact','on', true)` (transaction-local) then **all** audit rows of those job cards/visits/responses/alerts get non-null `old_value`/`new_value` → `"[erased]"` and a non-empty `note` → "[erased]" (whole value, not per field); insert `erasure_journal` (on conflict nothing); returns the ids erased now. `logErasure(source, ids)` after commit: one `log.event('erasure', { source, count, jc1…jcN })` (ids only). Links stop working via §21 (`erased_at`).
- CSV (`csv.ts`): `toCsv(rows)` = UTF-8 BOM + RFC 4180 cells joined by CRLF (trailing CRLF); `csvCell` quotes on `" , CR LF`, prefixes `'` when the value starts (after spaces) with `= + - @` or starts with TAB/CR (formula injection). Columns: Branch, Job card, Service date, Name, Phone, Reg. no, Model, Link status, Submitted at (ISO), then one column per `QUESTIONNAIRE_V2` question (M6, §17.6), headed `<code> <wording>` (multi-select = options + text joined `; `).
- Screen `src/features/admin-customers/` (page `src/app/admin/customers/page.tsx`): `CustomersScreen`, `useCustomerSearch`, `CustomerRow`, `EraseDialog` + `useEraseCustomers` (password step-up).

## §25 Daily cron (`src/app/api/cron/daily/route.ts`, `src/server/jobs/cleanup.ts`, `vercel.json`) (as-built M5)
- `vercel.json`: `"crons": [{ "path": "/api/cron/daily", "schedule": "30 21 * * *" }]` (03:00 IST; Hobby runs within that hour), next to `buildCommand` and `regions` (§15.1).
- Route: `GET` only, `dynamic = 'force-dynamic'`, `maxDuration = 300`; authorised when SHA-256 of the `Authorization` header equals SHA-256 of `Bearer ${CRON_SECRET}` (`timingSafeEqual` on equal-length digests); `CRON_SECRET` unset → always 401 "Unauthorized". Then `runDailyCleanup(await getDb(), { now: () => new Date() })` → JSON `CleanupCounts`.
- Cut-offs: domain `retentionCutoffs(now): { unansweredOn, answeredOn, deletedBefore }` and `retentionDueDate(serviceDate, answered)` in `src/domain/retention.ts`. Both erase steps compare **`service_date <= cut-off`** (inclusive: a card whose service date equals the cut-off date is erased that day, matching SPEC F-10's worked example); purge alone is strict (`deleted_at < deletedBefore`).
- `runDailyCleanup(db, clock, options?: { elapsedMs?; budgetMs? }): Promise<CleanupCounts { unansweredErased; answeredErased; responsesPurged; sessionsRemoved; attemptsRemoved; limitsRemoved; stoppedEarly }>`. The three batch steps run in order, `CLEANUP_BATCH_SIZE` 500 per transaction, until done or `CLEANUP_BUDGET_MS` 240 s elapsed (`stoppedEarly` = budget spent; next run continues; all steps idempotent). Sessions and attempts run after them in one statement each, even when stopped early:

| Step | Rule (domain `retention.ts` cut-offs, IST dates) |
|---|---|
| unanswered | job cards not erased, no visit with `completed_at`, `service_date <= unansweredOn` (90 d) → `eraseJobCards(…, 'retention')` + `logErasure` per batch |
| answered | job cards not erased with a completed visit, `service_date <= answeredOn` (3 y) → same |
| purge deleted | responses with `deleted_at < deletedBefore` (30 d) → delete their alerts, then the responses; audit `response.purge` per row (actor System, branch null, no values) |
| sessions | `created_at <= now − 7 d`, or `last_active_at <= now − idle` by role (admins 12 h, support 2 h; §18.2) → delete |
| attempts, limits | `login_attempts.at`, `rate_limits.window_start` older than `ATTEMPTS_RETENTION_HOURS` 24 → delete |
| summary | one audit `system.cleanup` (actor null "System", entity `system`/`daily`, branch null, `new` = the counts) |

## §26 Setup, migrations, backup & restore (as-built M5)
- **`scripts/admin.ts`** (tsx, `DATABASE_URL_UNPOOLED`, or a `pglite:` `DATABASE_URL` for local/e2e; exports `initAdmin`, `reissueOtp`, `recoverMainAdmin`, `generateOneTimePassword` for tests): `init --name --email` → under a transaction-scoped advisory lock (concurrent runs serialise), refuses ("Users already exist; nothing changed") if any user; installs questionnaire v2 (idempotent; v1 before M6); creates `main_admin` with a printed 16-char one-time password, `must_set_password`, `otp_expires_at = now + 72 h`; audit `user.create` actor system. `reissue --email` → new one-time password + 72 h, ends the user's sessions (only for users still `must_set_password`); `recover --email --no-admin-can-sign-in` → only for an existing, **active** `main_admin` (a deactivated one is refused: reactivating needs an owner decision) (the flag records that the maintainer checked no main admin can sign in, G-14): sets a one-time password, `must_set_password`, 72 h, clears that email's attempts, ends sessions; both audited `user.otp_reissue` / `user.recover` actor system. `reapply-erasures --from <url>` (M5, `reapplyErasures(deps, source: Db)`): reads every `erasure_journal` id from the source DB, runs `eraseJobCards(…, 'request')` on this DB in one transaction (already-erased cards skipped, so a re-run changes nothing), `logErasure`, prints "Re-erased N job card(s)."; the journal's original `source` is not carried over. DB opening is duplicated with `migrate.ts` (known minor).
- **`clear-feedback --confirm-delete-all-feedback`** (M6, CR-2; `clearFeedback(deps, { confirm, env? })` in `scripts/adminClear.ts`, re-exported by `admin.ts`; `runClear` prints the counts): throws `ClearRefused` when `VERCEL_ENV` or `NODE_ENV` is `production` ("refused: clear-feedback never runs against production") or without the flag. One transaction: delete all `alerts`, `responses`, `link_tokens`, `visits`, `questionnaires` (counts returned as `ClearResult`), then all `rate_limits`; insert v2; audit `system.cleanup` (actor System, entity `system`/`clear-feedback`, branch null, `new` = counts + `installedVersion: 2`, note "CR-2: feedback cleared, questionnaire v2 installed"). Keeps branches, advisors, users, job cards, sessions, the audit log and the erasure journal. Run once per dev/preview DB at the CR-2 cut-over.
- **`scripts/golive-check.ts`** (M5, `pnpm golive:check`, SPEC §12.1; pure exported checks + `main()`): `checkContacts` (the three contact keys and `NEXT_PUBLIC_DEALER_PHONE` empty or equal to their `.env.example` placeholder, `CONTACT_PLACEHOLDERS` §15.5 + `DEALER_PHONE_PLACEHOLDER`), `checkAppUrl` (set, valid, `https:`, not localhost/127./0.0.0.0/[::1]), `checkDatabaseUrl` (not `pglite:`), `checkLaunchData` (read-only `count(*)` of `job_cards`, `visits`, `link_tokens`, `responses`, `alerts` must be 0; skipped on pglite; branches, advisors and users may exist). `runChecks` → `formatReport`: "golive:check PASSED…" exit 0, else "FAIL <key>: <message>" lines, exit 1; never prints a value; an exception prints only the error class.
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
| M4 | §15.0, §15.2 | M4 also built the §11 alerts server (§17.4); folder map: `tokens.ts`, `activity.ts`, `poller.ts`, `repos/{jobCardRules,visitRows}.ts`, features `support`, `feedback-form`, `admin-alerts`, `privacy`, page `/privacy`; `linkAccess.ts` folded into `repos/feedback.ts`; `jobCardRules.ts` lacks `server-only` | as built | T-03b, T-03c, T-04b, T-07b, T-22 |
| M4 | §15.5, §18.5 | `src/config/env.ts` drops zod (plain non-empty check, same behaviour); `POLL_SECONDS` parsing (missing / ≤ 0 → 30) | strict CSP blocks zod's eval probe on client pages | D-34, T-22s, T-22s2 |
| M4 | §15.5 | Company name and privacy phone/email stay env keys via `src/config/env.ts` as designed; the M4 placeholder constants in `contact.ts` are a known gap fixed by T-36 | owner decision | D-37, T-04b, T-36 |
| M4 | §16.1 | `rate_limits` buckets listed (`rpc_public`, `open`, `submit`); no migration in M4 | as built | T-04b |
| M4 | §17.2 | §8, §9, §11, §13 rows: as-built notes; `submissionId` optional (known minor); `listFreshJobCards` kept as stub; domain `JobCard`/`Visit` not amended (fields on the access types), known gap until M5 erasure | as built; owner: align with T-25 | D-38, T-01b, T-03b, T-04b, T-07b, T-25 |
| M4 | §17.3 | Real tracker + poller wired in `providers.tsx`; M4 built-repo list; remaining stubs (`listAudit` until T-09b) | as built | T-22, T-04b, T-07b |
| M4 | §17.4 | New: alerts server repo (branch scope, `branchId` for main admin, `branchName`, required `version` + atomic check, `alert.status` / `alert.note` audit, erased customers without notes, `LIST_LIMIT` 500) | as built | T-07b |
| M4 | §19 | Table: any branch staff act on any link; main admin cannot create job cards (no branch) | owner decisions | D-35, D-39, T-03b, T-03c |
| M4 | §20 | As built: `isActive` (60 s, header) vs `isInUse` (15 min, page load counts), `onResume`, `STAFF_TOPICS`, starts with the first subscriber; form context is a one-shot effect, not `staleTime: Infinity` | as built | T-22 |
| M4 | §21 | Visits methods, order and messages as built; any branch staff may resend/regenerate/cancel (not creator-only) and resend/regenerate also check erased; per-job-card advisory lock; cancelled current visit replaced by a new link; current-but-expired link → CONFLICT (Regenerate); client double-tap guard + retry | owner: G-8 as written; accepted as built | D-35, D-39, T-03c, T-03d |
| M4 | §21 | Public form: unknown codes not counted; limits keyed by link hash; limit + resolve run just outside the guarded claim transaction; `markOpened` client-only and guarded; hidden follow-up answers dropped, not rejected; `submissionIdFor` in `localStorage` | SPEC US-09; accepted as built | D-36, D-39, T-04b |
| M4 | §22 | Job card repo as built: `vehicleType?` in the input, idempotency per user (another user's reused `requestId` → "already exists"), main admin FORBIDDEN on create, messages, whole-card re-validation on update, `jobCardRules.ts`; `listFreshJobCards` stub remains | accepted as built | D-39, T-03b, T-01b |
| M4 | §23 | `advisor.rename` vs `advisor.update` still open after M4 (now before T-09b); `isUniqueViolation` also used by `jobCards.ts` | not in M4 scope | T-21 |
| M5 | §15.1, §15.2, §15.5 | `vercel.json` gained `crons`, lost the `git` key (main-deploy control now in Vercel settings). All pending paths built (cron route, `erasure.ts`, `csv.ts`, `jobs/cleanup.ts`, `golive-check.ts`, features `admin-{audit,customers,overview,responses}`). Env: | Contact keys never throw (unset → placeholder), go-live check enforces real values; `contact.ts` gap closed (re-exports `env`); new E2E-only `PUBLIC_FLOOD_LIMIT_OVERRIDE`; `CRON_SECRET` unset → 401 | as built | D-37, T-36 |
| M5 | §17.2, §17.3 | §12/§13 rows as built (`listAudit` has no `limit`; `AuditEntryView` string action); all repos built, only `listFreshJobCards` stub left; flood-limit override on `rpc_public`; domain `JobCard`/`Visit` alignment **still open** (repos map to phase-1 shapes) | as built | T-09b, T-01b, D-38, T-25 |
| M5 | §17.5 | New: analytics, responses (step-up edit/delete/restore, version CONFLICT, alert re-evaluation, 500-row cap), audit (cursor page 100) as built | as built | M5 |
| M5 | §23 | `advisor.rename` vs `advisor.update` still open after the audit screen shipped | not fixed in M5 | T-21 |
| M5 | §24 | Customers as built: phone-over-regNo search, erased excluded, messages; erase redacts whole audit values and notes (not per field); journal on conflict nothing; log event carries count + `jcN` ids; CSV also guards TAB/CR and leading spaces | as built | T-25 |
| M5 | §25 | Route/job as built (digest compare, budget option, `stoppedEarly`, sessions/attempts after batches); retention comparison wording fixed to `service_date <= cut-off` | as built; wording fix | T-16, T-30 |
| M5 | §26 | `reapply-erasures` and `golive-check.ts` built (checks, exit codes, no values printed) | as built | T-29 |
| M6 | §17.6 | New: questionnaire v2 (Q1–Q10, follow-ups on 1–2, Q10a slot) replaces v1 everywhere; alerts on Q1/Q4/Q8 = 1 or Q10 = Yes with slot; versioned drafts | CR-2 | CR-2 |
| M6 | §17.5, §17.6 | D-47 Overview: tile "Callbacks requested", expandable category rows with answer + follow-up bars, advisor table with weighted score (re-normalised over answered codes, min 3 responses); problem breakdown / question detail / comments blocks gone. Deviations from SPEC F-5 wording: tile "Responses" (not "Responses received"), tile order Avg satisfaction → Recommend → Responses → Rate → Callbacks → Open alerts, category titles = full step titles, branch in its own column | as built | D-47, T-39 |
| M6 | §16.1, §16.2, §21, §24 | `questionnaires` holds only v2; `questions_version` 2; no migration; public submit **rejects** stray/hidden answers (VALIDATION "Some answers are not valid.") instead of dropping them (D-36 now staff-edit only); CSV columns from v2; `ResponseListRow.q12` carries Q1 (known minor) | as built | CR-2, D-36 |
| M6 | §15.2, §26 | `clear-feedback` admin command (`scripts/adminClear.ts`): refuses production and missing flag; deletes feedback data, installs v2, audits `system.cleanup` | CR-2 cut-over | CR-2 |
