// @vitest-environment node
/* eslint-disable max-lines-per-function -- describe blocks group many one-line tests */
import type { PGlite } from "@electric-sql/pglite";
import { verify } from "@node-rs/argon2";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  AdminError,
  generateOneTimePassword,
  initAdmin,
  recoverMainAdmin,
  reissueOtp,
  type AdminDeps,
} from "../../../../scripts/admin";
import {
  auditLog,
  loginAttempts,
  questionnaires,
  sessions,
  users,
} from "../../../../src/server/db/schema";
import { createTestDb } from "../../../support/pglite";

const NOW = new Date("2026-12-01T09:00:00.000Z");
const IN_72H = new Date("2026-12-04T09:00:00.000Z");
const OWNER = { name: "Owner", email: "owner@chandrahonda.in" };

function one<T>(v: T | undefined): T {
  if (v === undefined) throw new Error("expected a row");
  return v;
}

let client: PGlite;
let deps: AdminDeps;
const open: PGlite[] = [];

beforeEach(async () => {
  const t = await createTestDb();
  client = t.client;
  open.push(client);
  deps = { db: t.db, now: () => NOW };
});
afterAll(async () => {
  await Promise.all(open.map((c) => c.close()));
});

const allUsers = () => deps.db.select().from(users);
const allAudit = () => deps.db.select().from(auditLog);

async function seedAdmin(mustSet: boolean, email: string) {
  const [u] = await deps.db
    .insert(users)
    .values({
      name: "Seeded",
      email,
      passwordHash: "old-hash",
      role: "main_admin",
      mustSetPassword: mustSet,
    })
    .returning();
  return one(u);
}

describe("generateOneTimePassword", () => {
  it("is 16 characters with no look-alikes and differs each call", () => {
    const a = generateOneTimePassword();
    expect(a).toMatch(/^[A-HJ-NP-Za-km-z2-9]{16}$/);
    expect(generateOneTimePassword()).not.toBe(a);
  });
});

describe("initAdmin (S-16, G-14)", () => {
  it("installs questionnaire v1 and one main admin with a 16-char one-time password valid 72 h", async () => {
    const r = await initAdmin(deps, { name: " Owner ", email: "Owner@ChandraHonda.in " });
    expect(r.created).toBe(true);
    if (!r.created) return;
    expect(r.password).toHaveLength(16);
    expect(r.expiresAt).toEqual(IN_72H);
    const rows = await allUsers();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: "Owner",
      email: "owner@chandrahonda.in",
      role: "main_admin",
      mustSetPassword: true,
      otpExpiresAt: IN_72H,
    });
    expect(await verify(one(rows[0]).passwordHash, r.password)).toBe(true);
    const qs = await deps.db.select().from(questionnaires);
    expect(qs.map((q) => q.version)).toEqual([1]);
  });

  it("audits actor system, and the password is never in the audit", async () => {
    const r = await initAdmin(deps, OWNER);
    const audit = await allAudit();
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ actorName: "system", actorId: null, action: "user.create" });
    if (r.created) expect(JSON.stringify(audit)).not.toContain(r.password);
  });

  it("a second run says nothing changed and changes nothing", async () => {
    const first = await initAdmin(deps, OWNER);
    const before = { users: await allUsers(), audit: await allAudit() };
    const second = await initAdmin(deps, { name: "Intruder", email: "other@x.in" });
    expect(second).toEqual({ created: false, message: "Users already exist; nothing changed" });
    expect(await allUsers()).toEqual(before.users);
    expect(await allAudit()).toEqual(before.audit);
    expect(first.created).toBe(true);
  });

  it("two concurrent inits with different emails create exactly one user", async () => {
    const results = await Promise.all([
      initAdmin(deps, { name: "A", email: "a@x.in" }),
      initAdmin(deps, { name: "B", email: "b@x.in" }),
    ]);
    expect(results.filter((r) => r.created)).toHaveLength(1);
    expect(results.filter((r) => !r.created)).toHaveLength(1);
    expect(await allUsers()).toHaveLength(1);
    expect(await allAudit()).toHaveLength(1);
  });

  it("refuses when any user exists, even a non-admin", async () => {
    await seedAdmin(false, "x@y.in");
    const r = await initAdmin(deps, OWNER);
    expect(r.created).toBe(false);
    expect(await allUsers()).toHaveLength(1);
  });
});

describe("reissueOtp", () => {
  it("gives a new password and 72 h to a user still on a one-time password, audited by system", async () => {
    const first = await initAdmin(deps, OWNER);
    const later = new Date("2026-12-19T10:00:00.000Z");
    const r = await reissueOtp({ ...deps, now: () => later }, { email: "OWNER@chandrahonda.in" });
    expect(r.expiresAt).toEqual(new Date("2026-12-22T10:00:00.000Z"));
    const [u] = await allUsers();
    expect(await verify(one(u).passwordHash, r.password)).toBe(true);
    if (first.created) expect(await verify(one(u).passwordHash, first.password)).toBe(false);
    const row = (await allAudit()).find((a) => a.action === "user.otp_reissue");
    expect(row).toMatchObject({ actorName: "system", actorId: null });
    expect(JSON.stringify(await allAudit())).not.toContain(r.password);
  });

  it("ends the user's existing sessions and leaves another user's alone", async () => {
    const mine = await seedAdmin(true, "mine@x.in");
    const other = await seedAdmin(true, "other@x.in");
    await deps.db.insert(sessions).values([
      { idHash: Buffer.from("a"), userId: mine.id },
      { idHash: Buffer.from("b"), userId: other.id },
    ]);
    await reissueOtp(deps, { email: "mine@x.in" });
    expect((await deps.db.select().from(sessions)).map((s) => s.userId)).toEqual([other.id]);
  });

  it("refuses a user who has already set a password, and changes nothing", async () => {
    await seedAdmin(false, "set@x.in");
    await expect(reissueOtp(deps, { email: "set@x.in" })).rejects.toThrow(AdminError);
    const [u] = await allUsers();
    expect(one(u).passwordHash).toBe("old-hash");
    expect(await allAudit()).toHaveLength(0);
  });

  it("refuses an unknown email", async () => {
    await expect(reissueOtp(deps, { email: "nobody@x.in" })).rejects.toThrow("No such user");
  });
});

describe("recoverMainAdmin (G-14)", () => {
  it("refuses without the --no-admin-can-sign-in flag and changes nothing", async () => {
    await seedAdmin(false, "boss@x.in");
    await expect(
      recoverMainAdmin(deps, { email: "boss@x.in", noAdminCanSignIn: false }),
    ).rejects.toThrow(/--no-admin-can-sign-in/);
    expect(one((await allUsers())[0]).passwordHash).toBe("old-hash");
    expect(await allAudit()).toHaveLength(0);
  });

  it("resets a main admin: new password, must_set_password, 72 h, attempts cleared, sessions ended, audited system", async () => {
    const boss = await seedAdmin(false, "boss@x.in");
    const other = await seedAdmin(false, "other@x.in");
    await deps.db.insert(sessions).values([
      { idHash: Buffer.from("a"), userId: boss.id },
      { idHash: Buffer.from("b"), userId: other.id },
    ]);
    await deps.db.insert(loginAttempts).values([
      { emailKey: "boss@x.in", ipHash: Buffer.from("i"), kind: "signin" },
      { emailKey: "other@x.in", ipHash: Buffer.from("i"), kind: "signin" },
    ]);
    const r = await recoverMainAdmin(deps, { email: "Boss@x.in", noAdminCanSignIn: true });
    const [u] = await deps.db.select().from(users).where(eq(users.id, boss.id));
    expect(u).toMatchObject({ mustSetPassword: true, otpExpiresAt: IN_72H });
    expect(await verify(one(u).passwordHash, r.password)).toBe(true);
    expect((await deps.db.select().from(sessions)).map((s) => s.userId)).toEqual([other.id]);
    expect((await deps.db.select().from(loginAttempts)).map((a) => a.emailKey)).toEqual([
      "other@x.in",
    ]);
    const audit = await allAudit();
    expect(audit[0]).toMatchObject({ action: "user.recover", actorName: "system", actorId: null });
    expect(JSON.stringify(audit)).not.toContain(r.password);
  });

  it("refuses a deactivated main admin and changes nothing", async () => {
    const boss = await seedAdmin(false, "boss@x.in");
    await deps.db.update(users).set({ active: false }).where(eq(users.id, boss.id));
    await deps.db.insert(sessions).values({ idHash: Buffer.from("a"), userId: boss.id });
    await deps.db
      .insert(loginAttempts)
      .values({ emailKey: "boss@x.in", ipHash: Buffer.from("i"), kind: "signin" });
    const before = {
      users: await allUsers(),
      sessions: await deps.db.select().from(sessions),
      attempts: await deps.db.select().from(loginAttempts),
      audit: await allAudit(),
    };
    await expect(
      recoverMainAdmin(deps, { email: "boss@x.in", noAdminCanSignIn: true }),
    ).rejects.toThrow(/deactivated/);
    await expect(
      recoverMainAdmin(deps, { email: "boss@x.in", noAdminCanSignIn: true }),
    ).rejects.toBeInstanceOf(AdminError);
    expect(await allUsers()).toEqual(before.users);
    expect(one((await allUsers())[0])).toMatchObject({
      passwordHash: "old-hash",
      otpExpiresAt: null,
    });
    expect(await deps.db.select().from(sessions)).toEqual(before.sessions);
    expect(await deps.db.select().from(loginAttempts)).toEqual(before.attempts);
    expect(await allAudit()).toEqual(before.audit);
  });

  it("refuses a user who is not a main admin, and an unknown email", async () => {
    await client.exec(`
      insert into branches(id,name,city) values ('00000000-0000-0000-0000-00000000000a','B','c');
      insert into users(name,email,password_hash,role,branch_id) values ('S','sup@x.in','h','support','00000000-0000-0000-0000-00000000000a');`);
    await expect(
      recoverMainAdmin(deps, { email: "sup@x.in", noAdminCanSignIn: true }),
    ).rejects.toThrow("recover only works for a main admin");
    await expect(
      recoverMainAdmin(deps, { email: "ghost@x.in", noAdminCanSignIn: true }),
    ).rejects.toThrow(AdminError);
    expect(await allAudit()).toHaveLength(0);
  });
});

describe("test_s16_first_admin_from_nothing (CLI, as Vikram would run it)", () => {
  const dir = mkdtempSync(join(tmpdir(), "psf-s16-"));
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });
  const env = { ...process.env, DATABASE_URL: `pglite:${dir}`, DATABASE_URL_UNPOOLED: "" };
  const cli = (...args: string[]) =>
    execFileSync("pnpm", ["exec", "tsx", "scripts/admin.ts", ...args], {
      env,
      encoding: "utf8",
    });

  it("creates owner@chandrahonda.in once; a second run changes nothing; reissue and recover are guarded", () => {
    execFileSync("pnpm", ["exec", "tsx", "scripts/migrate.ts"], { env, encoding: "utf8" });
    const first = cli("init", "--name", "Owner", "--email", "owner@chandrahonda.in");
    expect(first).toMatch(/One-time password: [A-Za-z0-9]{16}\n/);
    expect(first).toContain("(72 h)");
    expect(cli("init", "--name", "Vikram", "--email", "vikram@x.in")).toContain(
      "Users already exist; nothing changed",
    );
    expect(cli("reissue", "--email", "owner@chandrahonda.in")).toContain("One-time password:");
    expect(() => cli("recover", "--email", "owner@chandrahonda.in")).toThrow(
      /--no-admin-can-sign-in/,
    );
    expect(cli("recover", "--email", "owner@chandrahonda.in", "--no-admin-can-sign-in")).toContain(
      "One-time password:",
    );
  }, 120_000);
});
