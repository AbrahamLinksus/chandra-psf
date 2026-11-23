// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { auditLog, branches, sessions, users } from "@/server/db/schema";
import {
  createSession,
  endSession,
  endUserSessions,
  hashToken,
  idleLimitMs,
  newToken,
  readSession,
  touchSession,
  TOUCH_INTERVAL_MS,
} from "@/server/auth/session";
import { must, makeServerCtx, seedBranch, T0, seedUser } from "../../../support/serverCtx";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: () => undefined }));

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

type Env = Awaited<ReturnType<typeof makeServerCtx>>;
let env: Env;
let branchId: string;

beforeEach(async () => {
  env = await makeServerCtx();
  branchId = await seedBranch(env.db, "Velachery");
});
afterEach(async () => {
  await env.client.close();
});

describe("token and storage", () => {
  it("makes 32 random bytes and stores only the SHA-256, never the raw token (DB or log)", async () => {
    const uid = await seedUser(env.db, { role: "support", branchId });
    const id = await createSession(env.ctx, uid);
    const token = must(env.cookies.value);
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
    expect(newToken()).not.toBe(newToken());

    const rows = await env.db.select().from(sessions);
    expect(rows).toHaveLength(1);
    expect(must(rows[0]).idHash.equals(hashToken(token))).toBe(true);
    expect(id).toBe(hashToken(token).toString("hex"));
    expect(must(rows[0]).idHash.toString("utf8")).not.toContain(token);

    // raw token appears nowhere in any table or in the log
    const dump = JSON.stringify([
      await env.db.select().from(sessions),
      await env.db.select().from(users),
      await env.db.select().from(auditLog),
      await env.db.select().from(branches),
    ]);
    expect(dump).not.toContain(token);
    const info = await readSession(env.ctx);
    expect(JSON.stringify(info)).not.toContain(token);
    expect(env.lines.join("\n")).not.toContain(token);
  });
});

describe("readSession", () => {
  it("returns the user for a fresh session and null without a cookie or row", async () => {
    const uid = await seedUser(env.db, { role: "support", branchId, name: "Priya" });
    expect(await readSession(env.ctx)).toBeNull();
    await createSession(env.ctx, uid);
    const info = await readSession(env.ctx);
    expect(info?.user).toMatchObject({ id: uid, name: "Priya", role: "support", branchId });
    expect(info?.user).not.toHaveProperty("passwordHash");
    env.cookies.value = "not-a-real-token";
    expect(await readSession(env.ctx)).toBeNull();
  });

  it("rejects an inactive user", async () => {
    const uid = await seedUser(env.db, { role: "support", branchId });
    await createSession(env.ctx, uid);
    await env.db.update(users).set({ active: false }).where(eq(users.id, uid));
    expect(await readSession(env.ctx)).toBeNull();
  });

  it("rejects a user of an inactive branch, but not a main admin (no branch)", async () => {
    const uid = await seedUser(env.db, { role: "branch_admin", branchId });
    await createSession(env.ctx, uid);
    await env.db.update(branches).set({ active: false }).where(eq(branches.id, branchId));
    expect(await readSession(env.ctx)).toBeNull();

    const mid = await seedUser(env.db, { role: "main_admin" });
    await createSession(env.ctx, mid);
    expect((await readSession(env.ctx))?.user.role).toBe("main_admin");
  });
});

describe("readSession idle limits", () => {
  it("support idle limit is 2 h", async () => {
    const uid = await seedUser(env.db, { role: "support", branchId });
    expect(idleLimitMs("support")).toBe(2 * HOUR);
    await createSession(env.ctx, uid);
    env.clock.advance(2 * HOUR - 1);
    expect(await readSession(env.ctx)).not.toBeNull();
    env.clock.advance(1);
    expect(await readSession(env.ctx)).toBeNull();
  });

  it("admin idle limit is 12 h (both admin roles)", async () => {
    expect(idleLimitMs("branch_admin")).toBe(12 * HOUR);
    expect(idleLimitMs("main_admin")).toBe(12 * HOUR);
    const uid = await seedUser(env.db, { role: "branch_admin", branchId });
    await createSession(env.ctx, uid);
    env.clock.advance(12 * HOUR - 1);
    expect(await readSession(env.ctx)).not.toBeNull();
    env.clock.advance(1);
    expect(await readSession(env.ctx)).toBeNull();
  });

  it("rejects a session more than 7 days after sign-in even when kept active", async () => {
    const uid = await seedUser(env.db, { role: "main_admin" });
    await createSession(env.ctx, uid);
    for (let h = 0; h < 7 * 24 - 6; h += 6) {
      env.clock.advance(6 * HOUR);
      await touchSession(env.ctx, must(await readSession(env.ctx)));
    }
    env.clock.advance(7 * DAY - (env.clock.now().getTime() - T0.getTime()) - 1);
    const last = await readSession(env.ctx);
    expect(last).not.toBeNull();
    env.clock.advance(1);
    expect(await readSession(env.ctx)).toBeNull();
  });
});

describe("readSession (more)", () => {
  it("readSession never writes", async () => {
    const uid = await seedUser(env.db, { role: "support", branchId });
    await createSession(env.ctx, uid);
    env.clock.advance(10 * MIN);
    await readSession(env.ctx);
    const [row] = await env.db.select().from(sessions);
    expect(must(row).lastActiveAt.getTime()).toBe(must(row).createdAt.getTime());
  });

  it("test_s27_shared_desk_laptop: Priya's support session dies after 2 h idle; a 7-day-old admin session dies too", async () => {
    const priya = await seedUser(env.db, { role: "support", branchId, name: "Priya" });
    await createSession(env.ctx, priya);
    env.clock.advance(3 * HOUR); // lunch break, no sign-out
    expect(await readSession(env.ctx)).toBeNull();

    const owner = await seedUser(env.db, { role: "main_admin", name: "Owner" });
    await createSession(env.ctx, owner);
    env.clock.advance(7 * DAY + MIN);
    expect(await readSession(env.ctx)).toBeNull();
  });
});

describe("touchSession", () => {
  it("moves last_active_at at most once per 60 s", async () => {
    const uid = await seedUser(env.db, { role: "support", branchId });
    await createSession(env.ctx, uid);
    const info = must(await readSession(env.ctx));

    env.clock.advance(TOUCH_INTERVAL_MS - 1);
    expect(await touchSession(env.ctx, info)).toBe(false);
    env.clock.advance(1);
    expect(await touchSession(env.ctx, info)).toBe(true);
    const moved = must((await env.db.select().from(sessions))[0]).lastActiveAt;
    expect(moved.getTime()).toBe(env.clock.now().getTime());

    env.clock.advance(30_000);
    expect(await touchSession(env.ctx, info)).toBe(false);
    env.clock.advance(30_000);
    expect(await touchSession(env.ctx, info)).toBe(true);
  });

  it("a touch keeps an idle session alive", async () => {
    const uid = await seedUser(env.db, { role: "support", branchId });
    await createSession(env.ctx, uid);
    env.clock.advance(1.5 * HOUR);
    await touchSession(env.ctx, must(await readSession(env.ctx)));
    env.clock.advance(1.5 * HOUR);
    expect(await readSession(env.ctx)).not.toBeNull();
  });
});

describe("ending sessions", () => {
  it("endSession deletes the row and clears the cookie; without a cookie it still clears", async () => {
    const uid = await seedUser(env.db, { role: "support", branchId });
    await createSession(env.ctx, uid);
    await endSession(env.ctx);
    expect(await env.db.select().from(sessions)).toHaveLength(0);
    expect(env.cookies.cleared).toBe(1);
    await endSession(env.ctx);
    expect(env.cookies.cleared).toBe(2);
  });

  it("endUserSessions ends all of a user's sessions, or all but one", async () => {
    const uid = await seedUser(env.db, { role: "support", branchId });
    const other = await seedUser(env.db, { role: "support", branchId });
    const a = await createSession(env.ctx, uid);
    await createSession(env.ctx, uid);
    await createSession(env.ctx, other);

    await endUserSessions(env.db, uid, a);
    const left = await env.db.select().from(sessions);
    expect(left.map((r) => r.idHash.toString("hex")).includes(a)).toBe(true);
    expect(left).toHaveLength(2);

    await endUserSessions(env.db, uid);
    const rest = await env.db.select().from(sessions);
    expect(rest).toHaveLength(1);
    expect(must(rest[0]).userId).toBe(other);
  });
});
