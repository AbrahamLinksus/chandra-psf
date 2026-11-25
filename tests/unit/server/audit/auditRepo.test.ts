// @vitest-environment node
/* eslint-disable max-lines-per-function -- describe blocks group many one-line tests */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auditLog } from "@/server/db/schema";
import type { SessionUser } from "@/server/ctx";
import { makeServerCtx, seedBranch, seedUser } from "../../../support/serverCtx";

vi.mock("server-only", () => ({}));

const { ServerAuditRepo } = await import("@/server/repos/audit");
const { auditRpc } = await import("@/server/rpc/audit");

type Env = Awaited<ReturnType<typeof makeServerCtx>>;
let env: Env;
beforeEach(async () => {
  env = await makeServerCtx();
});
afterEach(async () => {
  await env.client.close();
});

const repo = () => new ServerAuditRepo(env.ctx);

function signIn(user: Pick<SessionUser, "id" | "role"> & Partial<SessionUser>): void {
  env.ctx.session = {
    sessionId: "s",
    createdAt: env.clock.now(),
    lastActiveAt: env.clock.now(),
    user: { name: "Meena", email: "m@chandra.in", branchId: null, mustSetPassword: false, ...user },
  };
}

async function asMain(): Promise<void> {
  signIn({ id: await seedUser(env.db, { role: "main_admin" }), role: "main_admin" });
}

async function asBranch(branchId: string): Promise<void> {
  signIn({
    id: await seedUser(env.db, { role: "branch_admin", branchId }),
    role: "branch_admin",
    branchId,
  });
}

async function seedRows(branchId: string | null, n: number, action = "link.create") {
  await env.db.insert(auditLog).values(
    Array.from({ length: n }, (_, i) => ({
      actorName: "Meena",
      branchId,
      action,
      entityType: "link",
      entityId: `e-${String(i)}`,
    })),
  );
}

describe("audit repo (US-19, G-W2)", () => {
  it("a branch admin sees only their branch; a requested other branch is ignored", async () => {
    const vel = await seedBranch(env.db, "Velachery");
    const ana = await seedBranch(env.db, "Anna Nagar");
    await seedRows(vel, 2);
    await seedRows(ana, 3);
    await asBranch(vel);
    const mine = await repo().listAudit({ branchId: ana });
    expect(mine.ok && mine.value.entries).toHaveLength(2);
    expect(mine.ok && mine.value.entries.every((e) => e.branchName === "Velachery")).toBe(true);
  });

  it("the main admin sees all branches and can filter by branch", async () => {
    const vel = await seedBranch(env.db, "Velachery");
    const ana = await seedBranch(env.db, "Anna Nagar");
    await seedRows(vel, 2);
    await seedRows(ana, 3);
    await asMain();
    const all = await repo().listAudit();
    expect(all.ok && all.value.entries).toHaveLength(5);
    const one = await repo().listAudit({ branchId: ana });
    expect(one.ok && one.value.entries).toHaveLength(3);
    expect(one.ok && one.value.entries[0]?.branchName).toBe("Anna Nagar");
  });

  it("pages 100 / 100 / 30 newest first, with a null cursor on the last page", async () => {
    await seedRows(null, 230);
    await asMain();
    const p1 = await repo().listAudit();
    if (!p1.ok) throw new Error("p1");
    expect(p1.value.entries).toHaveLength(100);
    expect(p1.value.nextCursor).not.toBeNull();
    const ids = p1.value.entries.map((e) => Number(e.id));
    expect([...ids].sort((a, b) => b - a)).toEqual(ids);
    const p2 = await repo().listAudit({ before: p1.value.nextCursor ?? "" });
    if (!p2.ok) throw new Error("p2");
    expect(p2.value.entries).toHaveLength(100);
    expect(Number(p2.value.entries[0]?.id)).toBeLessThan(ids[99] ?? 0);
    const p3 = await repo().listAudit({ before: p2.value.nextCursor ?? "" });
    if (!p3.ok) throw new Error("p3");
    expect(p3.value.entries).toHaveLength(30);
    expect(p3.value.nextCursor).toBeNull();
  });

  it("filters by action", async () => {
    await seedRows(null, 2, "link.create");
    await seedRows(null, 1, "alert.status");
    await asMain();
    const got = await repo().listAudit({ action: "alert.status" });
    expect(got.ok && got.value.entries.map((e) => e.action)).toEqual(["alert.status"]);
  });

  it("lists an alert.status entry with old, new and note; actorId null + system shows System", async () => {
    await env.db.insert(auditLog).values([
      {
        actorId: null,
        actorName: "system",
        action: "alert.status",
        entityType: "alert",
        entityId: "a1",
        oldValue: { status: "open" },
        newValue: { status: "contacted" },
        note: "Called customer",
      },
      { actorName: "Meena", action: "link.create", entityType: "link", entityId: "l1" },
    ]);
    await asMain();
    const got = await repo().listAudit();
    if (!got.ok) throw new Error("list");
    const sys = got.value.entries.find((e) => e.action === "alert.status");
    expect(sys).toMatchObject({
      actorName: "System",
      oldValue: { status: "open" },
      newValue: { status: "contacted" },
      note: "Called customer",
      branchName: null,
    });
    const plain = got.value.entries.find((e) => e.action === "link.create");
    expect(plain?.actorName).toBe("Meena");
    expect(plain && "note" in plain).toBe(false);
  });

  it("refuses support with FORBIDDEN and a signed-out caller with UNAUTHENTICATED", async () => {
    const vel = await seedBranch(env.db, "Velachery");
    expect(await repo().listAudit()).toMatchObject({
      ok: false,
      error: { code: "UNAUTHENTICATED" },
    });
    signIn({
      id: await seedUser(env.db, { role: "support", branchId: vel }),
      role: "support",
      branchId: vel,
    });
    expect(await repo().listAudit()).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  });

  it("the RPC table has no write method", () => {
    expect(Object.keys(auditRpc)).toEqual(["listAudit"]);
  });
});
