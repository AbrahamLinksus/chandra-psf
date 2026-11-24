// @vitest-environment node
/* eslint-disable max-lines-per-function -- describe blocks group many one-line tests */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { alerts, auditLog, jobCards, responses } from "@/server/db/schema";
import type { SessionUser } from "@/server/ctx";
import { makeServerCtx, must, seedBranch, seedUser } from "../../../support/serverCtx";
import { seedLink } from "../feedback/harness";

vi.mock("server-only", () => ({}));

const { ServerAlertRepo } = await import("@/server/repos/alerts");

type Env = Awaited<ReturnType<typeof makeServerCtx>>;
let env: Env;
beforeEach(async () => {
  env = await makeServerCtx();
});
afterEach(async () => {
  await env.client.close();
});

const repo = () => new ServerAlertRepo(env.ctx);

function signIn(user: Pick<SessionUser, "id" | "role"> & Partial<SessionUser>): void {
  env.ctx.session = {
    sessionId: "s",
    createdAt: env.clock.now(),
    lastActiveAt: env.clock.now(),
    user: { name: "Meena", email: "m@chandra.in", branchId: null, mustSetPassword: false, ...user },
  };
}

async function seedAlert(branchId: string, no: string) {
  const s = await seedLink(env.db, { branchId, no, now: env.clock.now() });
  const [resp] = await env.db
    .insert(responses)
    .values({
      visitId: s.visitId,
      questionsVersion: 1,
      answers: {},
      submissionId: crypto.randomUUID(),
    })
    .returning();
  const [alert] = await env.db
    .insert(alerts)
    .values({
      responseId: must(resp).id,
      branchId,
      reasons: [{ kind: "callback" }],
      notes: [],
    })
    .returning();
  return { s, resp: must(resp), alert: must(alert) };
}

async function twoBranches() {
  const vel = await seedBranch(env.db, "Velachery");
  const ana = await seedBranch(env.db, "Anna Nagar");
  const a = await seedAlert(vel, "JC-1");
  const b = await seedAlert(ana, "JC-2");
  return { vel, ana, a, b };
}

describe("alert repo (US-13, AC-8, S-13)", () => {
  it("scopes the list and badge to the branch; the main admin sees all with branch names", async () => {
    const { vel, a } = await twoBranches();
    signIn({
      id: await seedUser(env.db, { role: "branch_admin", branchId: vel }),
      role: "branch_admin",
      branchId: vel,
    });
    const mine = await repo().listAlerts();
    expect(mine.ok && mine.value.map((x) => x.id)).toEqual([a.alert.id]);
    expect(await repo().countOpen()).toEqual({ ok: true, value: 1 });

    signIn({ id: await seedUser(env.db, { role: "main_admin" }), role: "main_admin" });
    const all = await repo().listAlerts();
    expect(all.ok && all.value.map((x) => x.branchName).sort()).toEqual([
      "Anna Nagar",
      "Velachery",
    ]);
    expect(await repo().countOpen()).toEqual({ ok: true, value: 2 });
    const one = await repo().listAlerts({ branchId: vel });
    expect(one.ok && one.value).toHaveLength(1);
  });

  it("refuses support and hides another branch's alert as not found", async () => {
    const { vel, b } = await twoBranches();
    signIn({
      id: await seedUser(env.db, { role: "support", branchId: vel }),
      role: "support",
      branchId: vel,
    });
    expect(await repo().listAlerts()).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(await repo().updateAlert(b.alert.id, { status: "contacted" }, 1)).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
    signIn({
      id: await seedUser(env.db, { role: "branch_admin", branchId: vel }),
      role: "branch_admin",
      branchId: vel,
    });
    expect(await repo().updateAlert(b.alert.id, { status: "contacted" }, 1)).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
  });

  it("changes status with a note, audits alert.status, and rejects a stale version", async () => {
    const { vel, a } = await twoBranches();
    signIn({
      id: await seedUser(env.db, { role: "branch_admin", branchId: vel, name: "Meena" }),
      role: "branch_admin",
      branchId: vel,
      name: "Meena",
    });
    const note = "Called, bike rechecked 22 Nov";
    const done = await repo().updateAlert(a.alert.id, { status: "contacted", note }, 1);
    expect(done).toMatchObject({ ok: true, value: { status: "contacted", version: 2 } });
    expect(done.ok && done.value.notes[0]).toMatchObject({ by: "Meena", text: note });
    const log = await env.db.select().from(auditLog).where(eq(auditLog.action, "alert.status"));
    expect(log).toHaveLength(1);
    expect(must(log[0])).toMatchObject({
      note,
      entityId: a.alert.id,
      oldValue: { status: "open" },
      newValue: { status: "contacted" },
    });
    const stale = await repo().updateAlert(a.alert.id, { note: "again" }, 1);
    expect(stale).toMatchObject({
      ok: false,
      error: {
        code: "CONFLICT",
        message: "Someone else changed this alert. Reload to see the latest.",
      },
    });
  });

  it("hides alerts of deleted responses and shows erased customers", async () => {
    const { vel, a } = await twoBranches();
    signIn({
      id: await seedUser(env.db, { role: "branch_admin", branchId: vel }),
      role: "branch_admin",
      branchId: vel,
    });
    await env.db
      .update(jobCards)
      .set({ customerName: null, phone: null, erasedAt: env.clock.now() })
      .where(eq(jobCards.id, a.s.cardId));
    const erased = await repo().listAlerts();
    expect(erased.ok && erased.value[0]).toMatchObject({
      customerName: "Erased customer",
      phone: null,
    });
    await env.db
      .update(responses)
      .set({ deletedAt: env.clock.now() })
      .where(eq(responses.id, a.resp.id));
    expect(await repo().listAlerts()).toEqual({ ok: true, value: [] });
    expect(await repo().countOpen()).toEqual({ ok: true, value: 0 });
  });
  it("a branch admin asking for another branch's alerts still gets only their own", async () => {
    const { vel, ana, a } = await twoBranches();
    signIn({
      id: await seedUser(env.db, { role: "branch_admin", branchId: vel }),
      role: "branch_admin",
      branchId: vel,
    });
    const got = await repo().listAlerts({ branchId: ana });
    expect(got.ok && got.value.map((x) => x.id)).toEqual([a.alert.id]);
  });

  it("refuses support the badge count too", async () => {
    const { vel } = await twoBranches();
    signIn({
      id: await seedUser(env.db, { role: "support", branchId: vel }),
      role: "support",
      branchId: vel,
    });
    expect(await repo().countOpen()).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  });

  it("filters by status and the badge counts only open alerts", async () => {
    const { vel, a } = await twoBranches();
    signIn({
      id: await seedUser(env.db, { role: "branch_admin", branchId: vel }),
      role: "branch_admin",
      branchId: vel,
    });
    await repo().updateAlert(a.alert.id, { status: "contacted" }, 1);
    expect(await repo().countOpen()).toEqual({ ok: true, value: 0 });
    const open = await repo().listAlerts({ status: "open" });
    expect(open).toEqual({ ok: true, value: [] });
    const contacted = await repo().listAlerts({ status: "contacted" });
    expect(contacted.ok && contacted.value.map((x) => x.id)).toEqual([a.alert.id]);
  });

  it("a note-only change audits alert.note (no alert.status) and keeps the status", async () => {
    const { vel, a } = await twoBranches();
    signIn({
      id: await seedUser(env.db, { role: "branch_admin", branchId: vel }),
      role: "branch_admin",
      branchId: vel,
    });
    const done = await repo().updateAlert(a.alert.id, { note: "  Left a voicemail  " }, 1);
    expect(done).toMatchObject({ ok: true, value: { status: "open", version: 2 } });
    expect(done.ok && done.value.notes[0]?.text).toBe("Left a voicemail");
    const note = await env.db.select().from(auditLog).where(eq(auditLog.action, "alert.note"));
    expect(note).toHaveLength(1);
    expect(must(note[0])).toMatchObject({ note: "Left a voicemail", entityId: a.alert.id });
    const status = await env.db.select().from(auditLog).where(eq(auditLog.action, "alert.status"));
    expect(status).toHaveLength(0);
  });

  it("rejects an empty change and a malformed id, writing no audit", async () => {
    const { vel, a } = await twoBranches();
    signIn({
      id: await seedUser(env.db, { role: "branch_admin", branchId: vel }),
      role: "branch_admin",
      branchId: vel,
    });
    expect(await repo().updateAlert(a.alert.id, { note: "   " }, 1)).toMatchObject({
      ok: false,
      error: { code: "VALIDATION" },
    });
    expect(await repo().updateAlert("not-a-uuid", { status: "resolved" }, 1)).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
    expect(await repo().updateAlert(crypto.randomUUID(), { status: "resolved" }, 1)).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
    expect(await env.db.select().from(auditLog)).toHaveLength(0);
  });

  it("a stale version changes nothing: no note, no audit, same version", async () => {
    const { vel, a } = await twoBranches();
    signIn({
      id: await seedUser(env.db, { role: "branch_admin", branchId: vel }),
      role: "branch_admin",
      branchId: vel,
    });
    await repo().updateAlert(a.alert.id, { status: "contacted" }, 1);
    const stale = await repo().updateAlert(a.alert.id, { status: "resolved", note: "late" }, 1);
    expect(stale).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    const [row] = await env.db.select().from(alerts).where(eq(alerts.id, a.alert.id));
    expect(must(row)).toMatchObject({ status: "contacted", version: 2, notes: [] });
    expect(await env.db.select().from(auditLog)).toHaveLength(1);
  });

  it("two saves with the same version: one wins, the other gets CONFLICT", async () => {
    const { vel, a } = await twoBranches();
    signIn({
      id: await seedUser(env.db, { role: "branch_admin", branchId: vel }),
      role: "branch_admin",
      branchId: vel,
    });
    const [x, y] = await Promise.all([
      repo().updateAlert(a.alert.id, { status: "contacted" }, 1),
      repo().updateAlert(a.alert.id, { status: "resolved" }, 1),
    ]);
    expect([x.ok, y.ok].sort()).toEqual([false, true]);
    const loser = x.ok ? y : x;
    expect(loser).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    const [row] = await env.db.select().from(alerts).where(eq(alerts.id, a.alert.id));
    expect(must(row).version).toBe(2);
  });

  it("the main admin updates any branch's alert; the audit carries that branch", async () => {
    const { ana, b } = await twoBranches();
    signIn({ id: await seedUser(env.db, { role: "main_admin" }), role: "main_admin" });
    const done = await repo().updateAlert(b.alert.id, { status: "resolved" }, 1);
    expect(done).toMatchObject({
      ok: true,
      value: { status: "resolved", branchName: "Anna Nagar" },
    });
    const log = await env.db.select().from(auditLog).where(eq(auditLog.action, "alert.status"));
    expect(must(log[0])).toMatchObject({ branchId: ana, entityId: b.alert.id });
  });

  it("an alert of a deleted response cannot be opened or updated", async () => {
    const { vel, a } = await twoBranches();
    signIn({
      id: await seedUser(env.db, { role: "branch_admin", branchId: vel }),
      role: "branch_admin",
      branchId: vel,
    });
    await env.db
      .update(responses)
      .set({ deletedAt: env.clock.now() })
      .where(eq(responses.id, a.resp.id));
    expect(await repo().updateAlert(a.alert.id, { status: "resolved" }, 1)).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
  });

  it("an erased customer shows no phone or registration number", async () => {
    const { vel, a } = await twoBranches();
    signIn({
      id: await seedUser(env.db, { role: "branch_admin", branchId: vel }),
      role: "branch_admin",
      branchId: vel,
    });
    await env.db
      .update(jobCards)
      .set({ customerName: null, phone: null, regNo: null, erasedAt: env.clock.now() })
      .where(eq(jobCards.id, a.s.cardId));
    const list = await repo().listAlerts();
    expect(list.ok && list.value[0]).toMatchObject({
      customerName: "Erased customer",
      phone: null,
      regNo: "",
    });
  });
});
