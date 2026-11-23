// @vitest-environment node
/* eslint-disable max-lines-per-function -- describe blocks group many one-line tests */
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auditLog, loginAttempts, sessions, users } from "@/server/db/schema";
import { readSession } from "@/server/auth/session";
import { hashPassword } from "@/server/auth/password";
import { hashIp } from "@/server/rateLimit";
import { makeServerCtx, must } from "../../../support/serverCtx";

vi.mock("server-only", () => ({}));

const { ServerAuthRepo } = await import("@/server/repos/auth");
const { verifyStepUp } = await import("@/server/auth/stepUp");

const PW = "Correct-Horse-9";
const BAD = "wrong-pass-1";
const EMAIL = "asha@chandrahonda.in";
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

async function seed(): Promise<string> {
  const [row] = await env.db
    .insert(users)
    .values({
      name: "Asha",
      email: EMAIL,
      passwordHash: pwHash,
      role: "main_admin",
      branchId: null,
    })
    .returning();
  return must(row).id;
}

async function signedIn(): Promise<string> {
  const id = await seed();
  await repo.signIn(EMAIL, PW);
  env.ctx.session = await readSession(env.ctx);
  return id;
}

function codeOf(r: { ok: boolean }): string {
  if (r.ok) return "OK";
  return (r as unknown as { error: { code: string } }).error.code;
}
const count = (xs: string[], c: string) => xs.filter((x) => x === c).length;
const attempts = async (kind: "signin" | "stepup") =>
  (await env.db.select().from(loginAttempts)).filter((a) => a.kind === kind);

describe("parallel sign-in limits (reviewer M1)", () => {
  it("8 parallel wrong sign-ins give 5 BAD_CREDENTIALS, 3 RATE_LIMITED, one lockout audit", async () => {
    await seed();
    const rs = await Promise.all(Array.from({ length: 8 }, () => repo.signIn(EMAIL, BAD)));
    const codes = rs.map(codeOf);
    expect(count(codes, "BAD_CREDENTIALS")).toBe(5);
    expect(count(codes, "RATE_LIMITED")).toBe(3);
    const audits = (await env.db.select().from(auditLog)).filter(
      (a) => a.action === "auth.lockout",
    );
    expect(audits).toHaveLength(1);
  });

  it("the per-IP cap of 30 holds for parallel attempts on different emails", async () => {
    const rs = await Promise.all(
      Array.from({ length: 34 }, (_, i) => repo.signIn(`nobody${String(i)}@example.in`, BAD)),
    );
    const codes = rs.map(codeOf);
    expect(count(codes, "BAD_CREDENTIALS")).toBe(30);
    expect(count(codes, "RATE_LIMITED")).toBe(4);
  });

  it("a right password after 5 parallel wrong ones is refused", async () => {
    await seed();
    await Promise.all(Array.from({ length: 5 }, () => repo.signIn(EMAIL, BAD)));
    expect(codeOf(await repo.signIn(EMAIL, PW))).toBe("RATE_LIMITED");
  });

  it("a right password deletes its reserved slot", async () => {
    await seed();
    expect((await repo.signIn(EMAIL, PW)).ok).toBe(true);
    expect(await attempts("signin")).toHaveLength(0);
  });
});

describe("parallel step-up limits (reviewer M1)", () => {
  it("5 parallel wrong passwords end sessions; a right one is then refused", async () => {
    const id = await signedIn();
    const rs = await Promise.all(
      Array.from({ length: 5 }, () => verifyStepUp(env.ctx, { password: "nope-nope-1" })),
    );
    const codes = rs.map(codeOf);
    expect(count(codes, "BAD_PASSWORD")).toBe(4);
    expect(count(codes, "UNAUTHENTICATED")).toBe(1);
    expect(await env.db.select().from(sessions).where(eq(sessions.userId, id))).toHaveLength(0);
    env.ctx.session = await readSession(env.ctx);
    expect(codeOf(await verifyStepUp(env.ctx, { password: PW }))).not.toBe("OK");
  });

  it("a right password is refused once 5 wrong ones are in flight, without ending sessions twice", async () => {
    await signedIn();
    for (let i = 0; i < 5; i++) {
      await env.db.insert(loginAttempts).values({
        emailKey: EMAIL,
        ipHash: hashIp(env.ctx.ip),
        at: env.clock.now(),
        kind: "stepup",
        userId: must((await env.db.select().from(users))[0]).id,
      });
    }
    expect(codeOf(await verifyStepUp(env.ctx, { password: PW }))).toBe("UNAUTHENTICATED");
    expect(await env.db.select().from(sessions)).toHaveLength(1);
  });

  it("a right password leaves no step-up failure row", async () => {
    await signedIn();
    expect((await verifyStepUp(env.ctx, { password: PW })).ok).toBe(true);
    expect(await attempts("stepup")).toHaveLength(0);
  });

  it("step-up failures are cleared when the sessions end", async () => {
    await signedIn();
    for (let i = 0; i < 5; i++) await verifyStepUp(env.ctx, { password: "nope-nope-1" });
    expect(await attempts("stepup")).toHaveLength(0);
  });
});
