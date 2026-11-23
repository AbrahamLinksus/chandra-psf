// @vitest-environment node
/* eslint-disable max-lines-per-function -- describe blocks group many one-line tests */
import { eq } from "drizzle-orm";
import { verify } from "@node-rs/argon2";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auditLog, branches, loginAttempts, sessions, users } from "@/server/db/schema";
import { readSession } from "@/server/auth/session";
import { DUMMY_HASH, hashPassword } from "@/server/auth/password";
import { makeServerCtx, must, seedBranch } from "../../../support/serverCtx";

vi.mock("server-only", () => ({}));
vi.mock("@/server/auth/password", async (orig) => {
  const real = await orig<typeof import("@/server/auth/password")>();
  return { ...real, verifyPassword: vi.fn(real.verifyPassword) };
});

const { ServerAuthRepo } = await import("@/server/repos/auth");
const password = await import("@/server/auth/password");

const PW = "Correct-Horse-9";
const HOUR = 3_600_000;
type Env = Awaited<ReturnType<typeof makeServerCtx>>;
let env: Env;
let repo: InstanceType<typeof ServerAuthRepo>;
let pwHash = "";

beforeEach(async () => {
  vi.mocked(password.verifyPassword).mockClear();
  env = await makeServerCtx();
  repo = new ServerAuthRepo(env.ctx);
  if (pwHash === "") pwHash = await hashPassword(PW);
});
afterEach(async () => {
  await env.client.close();
});

async function seed(o: {
  email?: string;
  role?: "support" | "main_admin";
  branchId?: string | null;
  active?: boolean;
  mustSetPassword?: boolean;
  otpExpiresAt?: Date | null;
}): Promise<string> {
  const [row] = await env.db
    .insert(users)
    .values({
      name: "Asha",
      email: o.email ?? "asha@chandrahonda.in",
      passwordHash: pwHash,
      role: o.role ?? "support",
      branchId: o.role === "main_admin" ? null : (o.branchId ?? null),
      active: o.active ?? true,
      mustSetPassword: o.mustSetPassword ?? false,
      otpExpiresAt: o.otpExpiresAt ?? null,
    })
    .returning();
  return must(row).id;
}

async function supportInBranch(): Promise<string> {
  return seed({ branchId: await seedBranch(env.db, "Velachery") });
}

function errorOf(r: { ok: boolean }): { code: string; message: string } {
  if (r.ok) throw new Error("expected an error");
  return (r as unknown as { error: { code: string; message: string } }).error;
}

describe("auth.signIn", () => {
  it("signs a support user in: session row, cookie, last sign-in, audit auth.sign_in", async () => {
    const id = await supportInBranch();
    const r = await repo.signIn(" Asha@ChandraHonda.in ", PW);
    expect(r.ok && r.value).toMatchObject({ id, role: "support", mustSetPassword: false });
    expect(env.cookies.value).toBeTruthy();
    expect(await env.db.select().from(sessions)).toHaveLength(1);
    const [u] = await env.db.select().from(users).where(eq(users.id, id));
    expect(must(u).lastSignInAt).toEqual(env.clock.now());
    const [a] = await env.db.select().from(auditLog);
    expect(a).toMatchObject({ action: "auth.sign_in", entityId: id, actorId: id });
  });

  it("gives a wrong password and an unknown email the same message, and verifies DUMMY_HASH for the unknown email", async () => {
    await supportInBranch();
    const wrong = await repo.signIn("asha@chandrahonda.in", "not-the-password");
    const unknown = await repo.signIn("nobody@chandrahonda.in", "not-the-password");
    expect(errorOf(wrong)).toEqual(errorOf(unknown));
    expect(errorOf(wrong)).toMatchObject({
      code: "BAD_CREDENTIALS",
      message: "Email or password is incorrect",
    });
    const hashes = vi.mocked(password.verifyPassword).mock.calls.map((c) => c[0]);
    expect(hashes).toEqual([pwHash, DUMMY_HASH]);
    expect(env.cookies.value).toBeUndefined();
    expect(await env.db.select().from(sessions)).toHaveLength(0);
  });

  it("refuses a deactivated user with 'Account disabled, contact admin'", async () => {
    await seed({ active: false, branchId: await seedBranch(env.db, "Velachery") });
    const r = await repo.signIn("asha@chandrahonda.in", PW);
    expect(errorOf(r)).toEqual({
      code: "ACCOUNT_DISABLED",
      message: "Account disabled, contact admin",
    });
    expect(await env.db.select().from(sessions)).toHaveLength(0);
  });

  it("refuses a user whose branch is deactivated, but only after the password is right", async () => {
    await supportInBranch();
    await env.db.update(branches).set({ active: false });
    expect(errorOf(await repo.signIn("asha@chandrahonda.in", PW)).message).toBe(
      "Account disabled, contact admin",
    );
    expect(errorOf(await repo.signIn("asha@chandrahonda.in", "wrong-one-1")).message).toBe(
      "Email or password is incorrect",
    );
  });

  it("refuses a one-time password older than 72 h and accepts one inside the window", async () => {
    const issued = env.clock.now();
    await seed({
      role: "main_admin",
      mustSetPassword: true,
      otpExpiresAt: new Date(issued.getTime() + 72 * HOUR),
    });
    env.clock.advance(72 * HOUR - 1000);
    const early = await repo.signIn("asha@chandrahonda.in", PW);
    expect(early.ok && early.value.mustSetPassword).toBe(true);
    env.clock.advance(2000);
    const late = await repo.signIn("asha@chandrahonda.in", PW);
    expect(errorOf(late)).toEqual({
      code: "OTP_EXPIRED",
      message: "This one-time password has expired. Ask for a new one.",
    });
  });

  it("locks an email after 5 failures (audited once) and then refuses even the right password", async () => {
    await supportInBranch();
    for (let i = 0; i < 6; i++) await repo.signIn("asha@chandrahonda.in", "wrong-pass-1");
    expect(errorOf(await repo.signIn("asha@chandrahonda.in", PW)).code).toBe("RATE_LIMITED");
    const audit = await env.db.select().from(auditLog);
    expect(audit.filter((a) => a.action === "auth.lockout")).toHaveLength(1);
    expect((await env.db.select().from(loginAttempts)).length).toBe(5);
  });

  it("never writes the password into the audit rows or the logs", async () => {
    await supportInBranch();
    await repo.signIn("asha@chandrahonda.in", "wrong-secret-77");
    await repo.signIn("asha@chandrahonda.in", PW);
    const dump = JSON.stringify(await env.db.select().from(auditLog)) + env.lines.join("\n");
    expect(dump).not.toContain(PW);
    expect(dump).not.toContain("wrong-secret-77");
    expect(dump).not.toContain(pwHash);
    expect(dump).not.toContain(must(env.cookies.value));
  });
});

describe("auth.setOwnPassword", () => {
  async function firstAdminSignedIn(): Promise<string> {
    const id = await seed({
      role: "main_admin",
      mustSetPassword: true,
      otpExpiresAt: new Date(env.clock.now().getTime() + 72 * HOUR),
    });
    await repo.signIn("asha@chandrahonda.in", PW);
    env.ctx.session = await readSession(env.ctx);
    return id;
  }

  it("refuses too short and too common passwords with the field named", async () => {
    await firstAdminSignedIn();
    expect(errorOf(await repo.setOwnPassword("short"))).toMatchObject({
      code: "VALIDATION",
      message: "Use at least 8 characters",
    });
    expect(errorOf(await repo.setOwnPassword("password"))).toMatchObject({
      code: "VALIDATION",
      message: "That password is too common. Choose another.",
    });
    const [u] = await env.db.select().from(users);
    expect(must(u).mustSetPassword).toBe(true);
  });

  it("stores an argon2id hash, clears the flag, ends other sessions and audits without the password", async () => {
    const id = await firstAdminSignedIn();
    const other = await env.db.insert(sessions).values({
      idHash: Buffer.from("other-session-hash-0000000000000"),
      userId: id,
      createdAt: env.clock.now(),
      lastActiveAt: env.clock.now(),
    });
    expect(other).toBeDefined();
    const r = await repo.setOwnPassword("Brand-New-Pass-42");
    expect(r.ok && r.value.mustSetPassword).toBe(false);
    const [u] = await env.db.select().from(users).where(eq(users.id, id));
    expect(must(u).passwordHash).toMatch(/^\$argon2id\$/);
    expect(await verify(must(u).passwordHash, "Brand-New-Pass-42")).toBe(true);
    expect(must(u).otpExpiresAt).toBeNull();
    expect(await env.db.select().from(sessions)).toHaveLength(1);
    const audit = await env.db.select().from(auditLog);
    expect(audit.map((a) => a.action)).toContain("user.set_password");
    expect(JSON.stringify(audit) + env.lines.join("\n")).not.toContain("Brand-New-Pass-42");
    expect((await repo.signIn("asha@chandrahonda.in", "Brand-New-Pass-42")).ok).toBe(true);
  });

  it("needs a session, and refuses a user who is not required to set a password", async () => {
    await seed({ role: "main_admin" });
    expect(errorOf(await repo.setOwnPassword("Brand-New-Pass-42")).code).toBe("UNAUTHENTICATED");
    await repo.signIn("asha@chandrahonda.in", PW);
    env.ctx.session = await readSession(env.ctx);
    expect(errorOf(await repo.setOwnPassword("Brand-New-Pass-42")).code).toBe("FORBIDDEN");
  });
});

describe("auth.signOut and currentUser", () => {
  it("signOut deletes the session row on the server and clears the cookie", async () => {
    await supportInBranch();
    await repo.signIn("asha@chandrahonda.in", PW);
    env.ctx.session = await readSession(env.ctx);
    expect((await repo.currentUser()).ok).toBe(true);
    await repo.signOut();
    expect(await env.db.select().from(sessions)).toHaveLength(0);
    expect(env.cookies.value).toBeUndefined();
    expect(await readSession(env.ctx)).toBeNull();
  });

  it("currentUser is null without a session", async () => {
    expect(await repo.currentUser()).toEqual({ ok: true, value: null });
  });
});
