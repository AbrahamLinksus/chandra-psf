// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ok } from "@/data/access/result";
import { guard } from "@/server/ctx";
import { writeAudit } from "@/server/audit";
import { auditLog } from "@/server/db/schema";
import { createLogger } from "@/server/log";
import { must, makeServerCtx, seedBranch, seedUser } from "../../../support/serverCtx";
import type { SessionInfo } from "@/server/ctx";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: () => undefined }));

describe("guard", () => {
  const mk = () => {
    const lines: string[] = [];
    return { lines, ctx: { log: createLogger((l) => lines.push(l)) } };
  };
  class DbDownError extends Error {}

  it("passes a result through", async () => {
    const { ctx } = mk();
    expect(await guard(ctx, "repo.read", "read", () => Promise.resolve(ok(5)))).toEqual(ok(5));
  });

  it("a thrown error in a write becomes SAVE_FAILED; the log holds the class only", async () => {
    const { ctx, lines } = mk();
    const r = await guard(ctx, "repo.write", "write", () =>
      Promise.reject(new DbDownError("password=hunter2 for a@b.in")),
    );
    expect(!r.ok && r.error.code).toBe("SAVE_FAILED");
    expect(lines).toHaveLength(1);
    expect(JSON.parse(must(lines[0]))).toMatchObject({
      where: "repo.write",
      errorClass: "DbDownError",
    });
    expect(lines[0]).not.toContain("hunter2");
    expect(lines[0]).not.toContain("a@b.in");
  });

  it("a thrown error in a read becomes UNAVAILABLE; non-Error throws log UnknownError", async () => {
    const { ctx, lines } = mk();
    const r = await guard(ctx, "repo.read", "read", () =>
      Promise.reject(new (class _Weird extends Error {})("secret string")),
    );
    expect(!r.ok && r.error.code).toBe("UNAVAILABLE");
    expect((JSON.parse(must(lines[0])) as { errorClass: string }).errorClass).toBe("UnknownError");
    expect(lines[0]).not.toContain("secret");
  });
});

describe("guard (bad where)", () => {
  const mk = () => ({ log: createLogger(() => undefined) });
  it("an unsafe `where` does not make guard throw", async () => {
    const ctx = mk();
    const r = await guard(ctx, "bad where with spaces!", "write", () =>
      Promise.reject(new Error("x")),
    );
    expect(!r.ok && r.error.code).toBe("SAVE_FAILED");
  });
});

let env: Awaited<ReturnType<typeof makeServerCtx>>;
beforeEach(async () => {
  env = await makeServerCtx();
});
afterEach(async () => {
  await env.client.close();
});

const sessionFor = (id: string, name: string, branchId: string | null): SessionInfo => ({
  sessionId: "00",
  user: {
    id,
    name,
    email: "e@example.in",
    role: "branch_admin",
    branchId,
    mustSetPassword: false,
  },
  createdAt: new Date(),
  lastActiveAt: new Date(),
});

describe("writeAudit", () => {
  it("stamps actor, actor's branch and ctx-clock time", async () => {
    const b = await seedBranch(env.db, "Velachery");
    const uid = await seedUser(env.db, { role: "branch_admin", branchId: b, name: "Kavitha" });
    const ctx = { ...env.ctx, session: sessionFor(uid, "Kavitha", b) };
    await writeAudit(ctx, env.db, {
      action: "advisor.create",
      entityType: "advisor",
      entityId: "a1",
      newValue: { n: 1 },
      note: "hi",
    });
    const [row] = await env.db.select().from(auditLog);
    expect(row).toMatchObject({
      actorId: uid,
      actorName: "Kavitha",
      branchId: b,
      action: "advisor.create",
      entityType: "advisor",
      entityId: "a1",
      newValue: { n: 1 },
      oldValue: null,
      note: "hi",
    });
    expect(must(row).at.getTime()).toBe(env.clock.now().getTime());
  });
});

describe("writeAudit (overrides)", () => {
  it("an explicit branchId (even null) overrides the actor's branch", async () => {
    const b = await seedBranch(env.db, "Velachery");
    const b2 = await seedBranch(env.db, "Adyar");
    const uid = await seedUser(env.db, { role: "branch_admin", branchId: b });
    const ctx = { ...env.ctx, session: sessionFor(uid, "K", b) };
    await writeAudit(ctx, env.db, { action: "x", entityType: "t", entityId: "1", branchId: b2 });
    await writeAudit(ctx, env.db, { action: "y", entityType: "t", entityId: "2", branchId: null });
    const rows = await env.db.select().from(auditLog);
    expect(rows.map((r) => r.branchId)).toEqual([b2, null]);
  });

  it("with no session it stamps the system actor; an explicit actor wins", async () => {
    await writeAudit(env.ctx, env.db, { action: "cron", entityType: "t", entityId: "1" });
    await writeAudit(env.ctx, env.db, {
      action: "lockout",
      entityType: "user",
      entityId: "2",
      actor: { id: null, name: "anon" },
    });
    const rows = await env.db.select().from(auditLog);
    expect(rows[0]).toMatchObject({ actorId: null, actorName: "system", branchId: null });
    expect(rows[1]).toMatchObject({ actorId: null, actorName: "anon" });
  });

  it("works inside a transaction", async () => {
    await env.db.transaction(async (tx) => {
      await writeAudit(env.ctx, tx, { action: "tx", entityType: "t", entityId: "1" });
    });
    expect(await env.db.select().from(auditLog)).toHaveLength(1);
  });
});
