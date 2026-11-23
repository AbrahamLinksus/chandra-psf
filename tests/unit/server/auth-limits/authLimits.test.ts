// @vitest-environment node
/* eslint-disable max-lines-per-function -- describe blocks group many one-line tests */
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auditLog, loginAttempts, sessions, users } from "@/server/db/schema";
import { readSession } from "@/server/auth/session";
import { hashPassword } from "@/server/auth/password";
import { MIN_PASSWORD_LENGTH } from "@/domain/constants";
import { makeServerCtx, must } from "../../../support/serverCtx";

vi.mock("server-only", () => ({}));

const { ServerAuthRepo, clearSignInFailures } = await import("@/server/repos/auth");
const { verifyStepUp } = await import("@/server/auth/stepUp");

const PW = "Correct-Horse-9";
const NEW_PW = "Brand-New-Pass-42";
const EMAIL = "asha@chandrahonda.in";
const LOCKED = "Too many attempts. Try again in 15 minutes.";
type Env = Awaited<ReturnType<typeof makeServerCtx>>;
let env: Env;
let repo: InstanceType<typeof ServerAuthRepo>;
let pwHash = "";

beforeEach(async () => {
  env = await makeServerCtx();
  repo = new ServerAuthRepo(env.ctx);
  if (pwHash === "") pwHash = await hashPassword(PW);
});
afterEach(async () => {
  await env.client.close();
});

async function seed(email = EMAIL): Promise<string> {
  const [row] = await env.db
    .insert(users)
    .values({ name: "Asha", email, passwordHash: pwHash, role: "main_admin", branchId: null })
    .returning();
  return must(row).id;
}

async function signedIn(): Promise<string> {
  const id = await seed();
  await repo.signIn(EMAIL, PW);
  env.ctx.session = await readSession(env.ctx);
  return id;
}

function errorOf(r: { ok: boolean }): { code: string; message: string } {
  if (r.ok) throw new Error("expected an error");
  return (r as unknown as { error: { code: string; message: string } }).error;
}

const lockouts = async () =>
  (await env.db.select().from(auditLog)).filter((a) => a.action === "auth.lockout");

describe("sign-in lockout (S-27, G-13)", () => {
  it("test_s27_sixth_wrong_password_is_locked_and_audited_once", async () => {
    await seed();
    for (let i = 0; i < 5; i++) {
      expect(errorOf(await repo.signIn(EMAIL, "wrong-pass-1")).code).toBe("BAD_CREDENTIALS");
    }
    const sixth = errorOf(await repo.signIn(EMAIL, "wrong-pass-1"));
    expect(sixth).toMatchObject({ code: "RATE_LIMITED", message: LOCKED });
    // even the right password is refused while locked
    expect(errorOf(await repo.signIn(EMAIL, PW)).message).toBe(LOCKED);
    expect(await lockouts()).toHaveLength(1);
  });

  it("audits the lockout exactly once for concurrent failures", async () => {
    await seed();
    await Promise.all(Array.from({ length: 8 }, () => repo.signIn(EMAIL, "wrong-pass-1")));
    expect(await lockouts()).toHaveLength(1);
  });

  it("failures older than 15 minutes no longer lock the email", async () => {
    await seed();
    for (let i = 0; i < 5; i++) await repo.signIn(EMAIL, "wrong-pass-1");
    env.clock.advance(15 * 60_000 + 1000);
    expect((await repo.signIn(EMAIL, PW)).ok).toBe(true);
  });

  it("limits an address after 30 failures across different emails", async () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({
      emailKey: `x${String(i)}@example.in`,
      ipHash: Buffer.alloc(0),
      at: env.clock.now(),
      kind: "signin" as const,
    }));
    const { hashIp } = await import("@/server/rateLimit");
    await env.db
      .insert(loginAttempts)
      .values(rows.map((r) => ({ ...r, ipHash: hashIp(env.ctx.ip) })));
    await seed();
    expect(errorOf(await repo.signIn(EMAIL, PW))).toMatchObject({
      code: "RATE_LIMITED",
      message: LOCKED,
    });
  });

  it("an admin reset (clearSignInFailures) clears the email's lock only", async () => {
    await seed();
    for (let i = 0; i < 5; i++) await repo.signIn(EMAIL, "wrong-pass-1");
    expect(errorOf(await repo.signIn(EMAIL, PW)).code).toBe("RATE_LIMITED");
    await clearSignInFailures(env.db, ` ${EMAIL.toUpperCase()} `);
    expect((await repo.signIn(EMAIL, PW)).ok).toBe(true);
  });
});

describe("verifyStepUp (G-13)", () => {
  it("passes for the right password", async () => {
    await signedIn();
    expect((await verifyStepUp(env.ctx, { password: PW })).ok).toBe(true);
  });

  it("wrong password gives BAD_PASSWORD 'Password incorrect'", async () => {
    await signedIn();
    expect(errorOf(await verifyStepUp(env.ctx, { password: "nope-nope-1" }))).toMatchObject({
      code: "BAD_PASSWORD",
      message: "Password incorrect",
    });
  });

  it("the 5th wrong in 15 minutes ends the user's sessions", async () => {
    await signedIn();
    for (let i = 0; i < 4; i++) {
      expect(errorOf(await verifyStepUp(env.ctx, { password: "nope-nope-1" })).code).toBe(
        "BAD_PASSWORD",
      );
    }
    expect(await env.db.select().from(sessions)).toHaveLength(1);
    expect(errorOf(await verifyStepUp(env.ctx, { password: "nope-nope-1" })).code).toBe(
      "UNAUTHENTICATED",
    );
    expect(await env.db.select().from(sessions)).toHaveLength(0);
    expect(env.cookies.cleared).toBeGreaterThan(0);
  });

  it("wrong passwords spread over more than 15 minutes do not end sessions", async () => {
    await signedIn();
    for (let i = 0; i < 6; i++) {
      env.clock.advance(4 * 60_000);
      expect(errorOf(await verifyStepUp(env.ctx, { password: "nope-nope-1" })).code).toBe(
        "BAD_PASSWORD",
      );
    }
  });
});

describe("auth.changePassword (US-28)", () => {
  it("refuses a wrong current password", async () => {
    await signedIn();
    expect(errorOf(await repo.changePassword("nope-nope-1", NEW_PW))).toMatchObject({
      code: "BAD_PASSWORD",
      message: "Password incorrect",
    });
  });

  it("rejects a too-short new password with the minimum length", async () => {
    await signedIn();
    const e = errorOf(await repo.changePassword(PW, "short"));
    expect(e.code).toBe("VALIDATION");
    expect(e.message).toBe(`Use at least ${String(MIN_PASSWORD_LENGTH)} characters`);
  });

  it("rejects a too-common new password", async () => {
    await signedIn();
    const e = errorOf(await repo.changePassword(PW, "password"));
    expect(e).toMatchObject({ code: "VALIDATION" });
    expect(e.message).toContain("too common");
  });

  it("succeeds: new password works, other sessions end, audit has no password", async () => {
    const id = await signedIn();
    const mine = must(env.ctx.session).sessionId;
    // a second session for the same user (another device)
    const other = await makeOtherSession();
    expect(await env.db.select().from(sessions)).toHaveLength(2);

    expect((await repo.changePassword(PW, NEW_PW)).ok).toBe(true);

    const left = await env.db.select().from(sessions);
    expect(left).toHaveLength(1);
    expect(left[0]?.idHash.toString("hex")).toBe(mine);
    expect(other).not.toBe(mine);
    const [a] = (await env.db.select().from(auditLog)).filter(
      (x) => x.action === "user.change_password",
    );
    expect(a).toMatchObject({ entityId: id, actorId: id });
    expect(JSON.stringify(a)).not.toContain(PW);
    expect(JSON.stringify(a)).not.toContain(NEW_PW);
    const [u] = await env.db.select().from(users).where(eq(users.id, id));
    expect(must(u).passwordHash).not.toBe(pwHash);
    env.cookies.value = undefined;
    expect(errorOf(await repo.signIn(EMAIL, PW)).code).toBe("BAD_CREDENTIALS");
    expect((await repo.signIn(EMAIL, NEW_PW)).ok).toBe(true);
  });
});

async function makeOtherSession(): Promise<string> {
  const { insertSession, hashToken } = await import("@/server/auth/session");
  const user = must((await env.db.select().from(users))[0]);
  const token = await insertSession(env.db, env.clock, user.id);
  return hashToken(token).toString("hex");
}
