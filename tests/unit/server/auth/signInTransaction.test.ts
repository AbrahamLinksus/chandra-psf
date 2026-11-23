// @vitest-environment node
/* eslint-disable max-lines-per-function -- describe blocks group many one-line tests */
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sessions, users } from "@/server/db/schema";
import { hashToken } from "@/server/auth/session";
import {
  ARGON2_PARAM_PREFIX,
  DUMMY_HASH,
  hashPassword,
  verifyPassword,
} from "@/server/auth/password";
import { makeServerCtx, must, seedBranch } from "../../../support/serverCtx";

vi.mock("server-only", () => ({}));
const audit = vi.hoisted(() => ({ failNext: false }));
vi.mock("@/server/audit", async (orig) => {
  const real = await orig<typeof import("@/server/audit")>();
  return {
    ...real,
    writeAudit: vi.fn((...args: Parameters<typeof real.writeAudit>) => {
      if (audit.failNext && args[2].action === "auth.sign_in") {
        return Promise.reject(new Error("audit boom"));
      }
      return real.writeAudit(...args);
    }),
  };
});

const { ServerAuthRepo } = await import("@/server/repos/auth");

const PW = "Correct-Horse-9";
type Env = Awaited<ReturnType<typeof makeServerCtx>>;
let env: Env;
let repo: InstanceType<typeof ServerAuthRepo>;
let pwHash = "";

beforeEach(async () => {
  audit.failNext = false;
  env = await makeServerCtx();
  repo = new ServerAuthRepo(env.ctx);
  if (pwHash === "") pwHash = await hashPassword(PW);
});
afterEach(async () => {
  await env.client.close();
});

async function seedUser(email: string): Promise<string> {
  const [row] = await env.db
    .insert(users)
    .values({
      name: "Asha",
      email,
      passwordHash: pwHash,
      role: "support",
      branchId: await seedBranch(env.db, `B-${email}`),
    })
    .returning();
  return must(row).id;
}

async function giveSession(userId: string, token: string): Promise<void> {
  await env.db.insert(sessions).values({
    idHash: hashToken(token),
    userId,
    createdAt: env.clock.now(),
    lastActiveAt: env.clock.now(),
  });
}

describe("sign-in with an existing session cookie", () => {
  it("deletes the old session row, leaves exactly one new one, and spares other users", async () => {
    const asha = await seedUser("asha@chandrahonda.in");
    const ravi = await seedUser("ravi@chandrahonda.in");
    await giveSession(asha, "old-token");
    await giveSession(ravi, "ravi-token");
    env.cookies.value = "old-token";

    const r = await repo.signIn("asha@chandrahonda.in", PW);
    expect(r.ok).toBe(true);

    const rows = await env.db.select().from(sessions);
    expect(rows).toHaveLength(2);
    const ids = rows.map((s) => s.idHash.toString("hex"));
    expect(ids).not.toContain(hashToken("old-token").toString("hex"));
    expect(ids).toContain(hashToken("ravi-token").toString("hex"));
    const ashaRows = rows.filter((s) => s.userId === asha);
    expect(ashaRows).toHaveLength(1);
    expect(ashaRows[0]?.idHash.equals(hashToken(must(env.cookies.value)))).toBe(true);
    expect(env.cookies.value).not.toBe("old-token");
  });
});

describe("a failure inside the sign-in transaction", () => {
  it("rolls everything back: old session kept, no new row, last sign-in unchanged, cookie untouched", async () => {
    const id = await seedUser("asha@chandrahonda.in");
    await giveSession(id, "old-token");
    env.cookies.value = "old-token";
    audit.failNext = true;

    const r = await repo.signIn("asha@chandrahonda.in", PW);
    expect(r.ok).toBe(false);

    const rows = await env.db.select().from(sessions);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.idHash.equals(hashToken("old-token"))).toBe(true);
    const [u] = await env.db.select().from(users).where(eq(users.id, id));
    expect(must(u).lastSignInAt).toBeNull();
    expect(env.cookies.value).toBe("old-token");
  });

  it("with no prior cookie leaves no session row and sets no cookie", async () => {
    await seedUser("asha@chandrahonda.in");
    audit.failNext = true;
    await repo.signIn("asha@chandrahonda.in", PW);
    expect(await env.db.select().from(sessions)).toHaveLength(0);
    expect(env.cookies.value).toBeUndefined();
  });
});

describe("cookie is set only after success", () => {
  it("sets none for a bad password or a locked-out email", async () => {
    await seedUser("asha@chandrahonda.in");
    const set = vi.spyOn(env.cookies, "set");
    await repo.signIn("asha@chandrahonda.in", "wrong-pass-1");
    expect(set).not.toHaveBeenCalled();
    for (let i = 0; i < 5; i++) await repo.signIn("asha@chandrahonda.in", "wrong-pass-1");
    const locked = await repo.signIn("asha@chandrahonda.in", PW);
    expect(locked.ok).toBe(false);
    expect(set).not.toHaveBeenCalled();
    expect(env.cookies.value).toBeUndefined();
  });

  it("sets exactly one cookie on success", async () => {
    await seedUser("asha@chandrahonda.in");
    const set = vi.spyOn(env.cookies, "set");
    expect((await repo.signIn("asha@chandrahonda.in", PW)).ok).toBe(true);
    expect(set).toHaveBeenCalledTimes(1);
  });
});

describe("DUMMY_HASH", () => {
  it("carries the same argon2 parameters as real hashes", async () => {
    expect(DUMMY_HASH.startsWith(ARGON2_PARAM_PREFIX)).toBe(true);
    expect((await hashPassword("anything-1")).startsWith(ARGON2_PARAM_PREFIX)).toBe(true);
  });

  it("is verified for real (runs the full check) and rejects any input", async () => {
    expect(await verifyPassword(DUMMY_HASH, "")).toBe(false);
    expect(await verifyPassword(DUMMY_HASH, "Correct-Horse-9")).toBe(false);
  });
});
