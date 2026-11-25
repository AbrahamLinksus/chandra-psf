// Maintainer CLI: first admin, one-time-password reissue, main-admin recovery (LLD §26).
// Logic is exported (functions take a db handle) so tests and Playwright globalSetup can call it.
// Passwords are printed once by the CLI and never logged or audited.
import { randomInt } from "node:crypto";
import { count, eq, gt, sql } from "drizzle-orm";
import { QUESTIONNAIRE_V2 } from "../src/domain/questionnaire";
import { hashPassword } from "../src/server/auth/password";
import { writeAudit } from "../src/server/audit";
import type { Db, Tx } from "../src/server/db/client";
import { eraseJobCards, logErasure, type ErasureSource } from "../src/server/erasure";
import {
  erasureJournal,
  loginAttempts,
  questionnaires,
  sessions,
  users,
} from "../src/server/db/schema";
import { isPgliteUrl, parseServerEnv } from "../src/server/env";
import { parseCli } from "./adminCli";
import { runClear } from "./adminClear";
export { clearFeedback, type ClearResult } from "./adminClear";
export const OTP_LENGTH = 16;
export const OTP_TTL_HOURS = 72;
const MS_PER_HOUR = 3_600_000;
// Arbitrary constant key: serialises concurrent `init` runs (transaction-scoped advisory lock).
const INIT_LOCK_KEY = 7_319_001;
const REAPPLY_CHUNK_SIZE = 500;
const PGLITE_PREFIX_LENGTH = "pglite:".length;
// No look-alike characters (0/O, 1/l/I): the password is read off a terminal.
const OTP_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export class AdminError extends Error {}

export interface AdminDeps {
  db: Db;
  now?: () => Date;
}

export type InitResult =
  | { created: true; email: string; password: string; expiresAt: Date }
  | { created: false; message: string };

export interface OtpResult {
  email: string;
  password: string;
  expiresAt: Date;
}

export function generateOneTimePassword(): string {
  const chars = Array.from({ length: OTP_LENGTH }, () =>
    OTP_ALPHABET.charAt(randomInt(OTP_ALPHABET.length)),
  );
  return chars.join("");
}

const normEmail = (email: string): string => email.trim().toLowerCase();

function stamp(deps: AdminDeps): { session: null; clock: { now(): Date } } {
  return { session: null, clock: { now: deps.now ?? (() => new Date()) } };
}

async function issue(
  deps: AdminDeps,
): Promise<{ password: string; hash: string; expiresAt: Date }> {
  const password = generateOneTimePassword();
  const expiresAt = new Date(stamp(deps).clock.now().getTime() + OTP_TTL_HOURS * MS_PER_HOUR);
  return { password, hash: await hashPassword(password), expiresAt };
}

async function findUser(tx: Tx, email: string): Promise<typeof users.$inferSelect | undefined> {
  const rows = await tx
    .select()
    .from(users)
    .where(eq(sql`lower(${users.email})`, email))
    .limit(1);
  return rows[0];
}

export async function initAdmin(
  deps: AdminDeps,
  input: { name: string; email: string },
): Promise<InitResult> {
  const email = normEmail(input.email);
  const otp = await issue(deps);
  return deps.db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${INIT_LOCK_KEY})`);
    const [existing] = await tx.select({ n: count() }).from(users);
    if ((existing?.n ?? 0) > 0) {
      return { created: false, message: "Users already exist; nothing changed" };
    }
    await tx
      .insert(questionnaires)
      .values({ version: QUESTIONNAIRE_V2.version, definition: QUESTIONNAIRE_V2 })
      .onConflictDoNothing();
    const [user] = await tx
      .insert(users)
      .values({
        name: input.name.trim(),
        email,
        passwordHash: otp.hash,
        role: "main_admin",
        mustSetPassword: true,
        otpExpiresAt: otp.expiresAt,
      })
      .returning({ id: users.id });
    if (!user) throw new AdminError("could not create the admin");
    await writeAudit(stamp(deps), tx, {
      action: "user.create",
      entityType: "user",
      entityId: user.id,
      newValue: { email, role: "main_admin", mustSetPassword: true },
      note: "first admin created by setup script",
    });
    return { created: true, email, password: otp.password, expiresAt: otp.expiresAt };
  });
}

export async function reissueOtp(deps: AdminDeps, input: { email: string }): Promise<OtpResult> {
  const email = normEmail(input.email);
  const otp = await issue(deps);
  return deps.db.transaction(async (tx) => {
    const user = await findUser(tx, email);
    if (!user) throw new AdminError("No such user");
    if (!user.mustSetPassword) {
      throw new AdminError("reissue only works for users who have not set a password yet");
    }
    await tx
      .update(users)
      .set({
        passwordHash: otp.hash,
        otpExpiresAt: otp.expiresAt,
        updatedAt: stamp(deps).clock.now(),
      })
      .where(eq(users.id, user.id));
    await tx.delete(sessions).where(eq(sessions.userId, user.id));
    await writeAudit(stamp(deps), tx, {
      action: "user.otp_reissue",
      entityType: "user",
      entityId: user.id,
      branchId: user.branchId,
      newValue: { email, otpExpiresAt: otp.expiresAt.toISOString() },
    });
    return { email, password: otp.password, expiresAt: otp.expiresAt };
  });
}

export async function recoverMainAdmin(
  deps: AdminDeps,
  input: { email: string; noAdminCanSignIn: boolean },
): Promise<OtpResult> {
  if (!input.noAdminCanSignIn) {
    throw new AdminError(
      "refused: pass --no-admin-can-sign-in to confirm no main admin can sign in",
    );
  }
  const email = normEmail(input.email);
  const otp = await issue(deps);
  return deps.db.transaction(async (tx) => {
    const user = await findUser(tx, email);
    if (user?.role !== "main_admin") throw new AdminError("recover only works for a main admin");
    if (!user.active) {
      throw new AdminError(
        "recover: this main admin is deactivated; reactivating needs an owner decision, nothing changed",
      );
    }
    await tx
      .update(users)
      .set({
        passwordHash: otp.hash,
        mustSetPassword: true,
        otpExpiresAt: otp.expiresAt,
        updatedAt: stamp(deps).clock.now(),
      })
      .where(eq(users.id, user.id));
    await tx.delete(loginAttempts).where(eq(loginAttempts.emailKey, email));
    await tx.delete(sessions).where(eq(sessions.userId, user.id));
    await writeAudit(stamp(deps), tx, {
      action: "user.recover",
      entityType: "user",
      entityId: user.id,
      newValue: { email, otpExpiresAt: otp.expiresAt.toISOString() },
      note: "maintainer confirmed no main admin can sign in",
    });
    return { email, password: otp.password, expiresAt: otp.expiresAt };
  });
}

type Handle = { db: Db; url: string; close: () => Promise<void> };

async function openDb(): Promise<Handle> {
  const env = parseServerEnv(process.env);
  if (isPgliteUrl(env.DATABASE_URL)) return openUrl(env.DATABASE_URL);
  if (!env.DATABASE_URL_UNPOOLED) throw new AdminError("DATABASE_URL_UNPOOLED is required");
  return openUrl(env.DATABASE_URL_UNPOOLED);
}

/**
 * After a restore (LLD section 26): re-erases every job card in the source database's erasure
 * journal that is not erased here. A second run finds nothing left, so nothing changes.
 */
export async function reapplyErasures(
  deps: AdminDeps,
  source: Db,
  options: { since?: Date; chunkSize?: number } = {},
): Promise<{ erased: number }> {
  const { since, chunkSize = REAPPLY_CHUNK_SIZE } = options;
  const journal = await source
    .select({ id: erasureJournal.jobCardId, source: erasureJournal.source })
    .from(erasureJournal)
    .where(since ? gt(erasureJournal.erasedAt, since) : undefined)
    .orderBy(erasureJournal.jobCardId);
  const now = stamp(deps).clock.now();
  let erased = 0;
  for (let i = 0; i < journal.length; i += chunkSize) {
    const chunk = journal.slice(i, i + chunkSize);
    const done = await deps.db.transaction(async (tx) => {
      const results: { source: ErasureSource; ids: string[] }[] = [];
      for (const src of ["request", "retention"] as const) {
        const ids = chunk.filter((j) => j.source === src).map((j) => j.id);
        results.push({ source: src, ids: await eraseJobCards(tx, ids, src, now) });
      }
      return results;
    });
    for (const r of done) {
      logErasure(r.source, r.ids);
      erased += r.ids.length;
    }
  }
  return { erased };
}

async function openUrl(url: string): Promise<Handle> {
  const schema = await import("../src/server/db/schema");
  if (isPgliteUrl(url)) {
    const [{ PGlite }, { drizzle }] = await Promise.all([
      import("@electric-sql/pglite"),
      import("drizzle-orm/pglite"),
    ]);
    const target = url.slice(PGLITE_PREFIX_LENGTH);
    const client = new PGlite(target === "memory" ? undefined : target);
    return { db: drizzle(client, { schema }), url, close: () => client.close() };
  }
  const [{ Pool }, { drizzle }] = await Promise.all([
    import("@neondatabase/serverless"),
    import("drizzle-orm/neon-serverless"),
  ]);
  const pool = new Pool({ connectionString: url });
  return { db: drizzle(pool, { schema }), url, close: () => pool.end() };
}

function printOtp(r: OtpResult): void {
  console.log(`Email:             ${r.email}`);
  console.log(`One-time password: ${r.password}`);
  console.log(`Valid until:       ${r.expiresAt.toISOString()} (${String(OTP_TTL_HOURS)} h)`);
}

const USAGE =
  "usage: admin init --name <n> --email <e> | reissue --email <e> | recover --email <e> --no-admin-can-sign-in | reapply-erasures --from <url> [--since <date>] | clear-feedback --database-host <host> --confirm-delete-all-feedback";

async function runReapply(db: Db, from: string, sinceText: string | undefined): Promise<void> {
  const since = sinceText ? new Date(sinceText) : undefined;
  if (since && Number.isNaN(since.getTime())) throw new AdminError("--since is not a valid date");
  const source = await openUrl(from);
  try {
    const r = await reapplyErasures({ db }, source.db, since ? { since } : {});
    console.log(`Re-erased ${String(r.erased)} job card(s).`);
  } finally {
    await source.close();
  }
}

async function run(handle: Handle, argv: string[]): Promise<void> {
  const { db } = handle;
  const { values, positionals } = parseCli(argv);
  const [command] = positionals;
  const { name, email } = values;
  if (command === "clear-feedback") {
    await runClear(db, {
      confirm: values["confirm-delete-all-feedback"],
      expectedHost: values["database-host"],
      databaseUrl: handle.url,
    });
    return;
  }
  if (command === "reapply-erasures" && values.from) {
    await runReapply(db, values.from, values.since);
    return;
  }
  if (!email) throw new AdminError(USAGE);
  if (command === "init" && name) {
    const r = await initAdmin({ db }, { name, email });
    if (r.created) printOtp(r);
    else console.log(r.message);
  } else if (command === "reissue") {
    printOtp(await reissueOtp({ db }, { email }));
  } else if (command === "recover") {
    const noAdminCanSignIn = values["no-admin-can-sign-in"];
    printOtp(await recoverMainAdmin({ db }, { email, noAdminCanSignIn }));
  } else {
    throw new AdminError(USAGE);
  }
}

async function main(): Promise<void> {
  const handle = await openDb();
  try {
    await run(handle, process.argv.slice(2));
  } finally {
    await handle.close();
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((e: unknown) => {
    console.error(`admin failed: ${e instanceof Error ? e.message : "unknown error"}`);
    process.exit(1);
  });
}
