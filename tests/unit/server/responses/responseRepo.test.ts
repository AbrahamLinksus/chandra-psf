// @vitest-environment node
/* eslint-disable max-lines-per-function -- one describe groups many tests */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { alerts, auditLog, jobCards, responses, users } from "@/server/db/schema";
import type { SessionUser } from "@/server/ctx";
import { hashPassword } from "@/server/auth/password";
import { makeServerCtx, must, seedBranch, seedUser } from "../../../support/serverCtx";
import { happyAnswers, seedLink } from "../feedback/harness";

vi.mock("server-only", () => ({}));

const { ServerResponseRepo } = await import("@/server/repos/responses");

const PASSWORD = "Demo@2026";
const STALE = "Someone else changed this. Reload to see the latest.";
type Env = Awaited<ReturnType<typeof makeServerCtx>>;
let env: Env;
beforeEach(async () => {
  env = await makeServerCtx();
});
afterEach(async () => {
  await env.client.close();
});
const repo = () => new ServerResponseRepo(env.ctx);
const RANGE = { from: "2000-01-01", to: "2100-01-01" };

async function signIn(role: "branch_admin" | "main_admin" | "support", branchId: string | null) {
  const id = await seedUser(env.db, { role, branchId });
  await env.db
    .update(users)
    .set({ passwordHash: await hashPassword(PASSWORD) })
    .where(eq(users.id, id));
  const user: SessionUser = {
    id,
    role,
    name: "Meena",
    email: "m@chandra.in",
    branchId,
    mustSetPassword: false,
  };
  env.ctx.session = {
    sessionId: "s",
    createdAt: env.clock.now(),
    lastActiveAt: env.clock.now(),
    user,
  };
}

async function seedResponse(branchId: string, no: string, answers: Record<string, unknown>) {
  const s = await seedLink(env.db, { branchId, no, now: env.clock.now() });
  const [resp] = await env.db
    .insert(responses)
    .values({
      visitId: s.visitId,
      questionsVersion: 1,
      answers: answers,
      submissionId: crypto.randomUUID(),
    })
    .returning();
  return must(resp);
}

async function seedAlert(responseId: string, branchId: string, reasons: object[]) {
  const [a] = await env.db
    .insert(alerts)
    .values({ responseId, branchId, reasons: reasons, notes: [] })
    .returning();
  return must(a);
}

const q6Answers = () => happyAnswers({ Q6: 2, Q6a: { options: ["Rude"] }, Q12: 4, Q15: "No" });
const auditOf = (action: string) =>
  env.db.select().from(auditLog).where(eq(auditLog.action, action));

describe("response repo (AC-9, S-08, S-09, US-21, US-29, G-01, G-03)", () => {
  it("AC-9 edit Q6 2 -> 4 removes Q6a and audits the old and new answers", async () => {
    const vel = await seedBranch(env.db, "Velachery");
    const r = await seedResponse(vel, "JC-1", q6Answers());
    await signIn("branch_admin", vel);
    const done = await repo().editResponse(r.id, happyAnswers({ Q6: 4, Q12: 4, Q15: "No" }), 1, {
      password: PASSWORD,
    });
    expect(done).toMatchObject({ ok: true, value: { version: 2 } });
    const [row] = await env.db.select().from(responses).where(eq(responses.id, r.id));
    expect(must(row).answers).toMatchObject({ Q6: 4 });
    expect(must(row).answers).not.toHaveProperty("Q6a");
    const [entry] = await auditOf("response.edit");
    expect(must(entry)).toMatchObject({
      entityId: r.id,
      oldValue: { Q6: 2, Q6a: { options: ["Rude"] } },
      newValue: { Q6: 4 },
    });
  });

  it("G-01 a wrong password says 'Password incorrect' and saves nothing", async () => {
    const vel = await seedBranch(env.db, "Velachery");
    const r = await seedResponse(vel, "JC-1", q6Answers());
    await signIn("branch_admin", vel);
    const res = await repo().editResponse(r.id, happyAnswers({ Q6: 4, Q12: 4, Q15: "No" }), 1, {
      password: "nope",
    });
    expect(res).toMatchObject({ ok: false, error: { message: "Password incorrect" } });
    const [row] = await env.db.select().from(responses).where(eq(responses.id, r.id));
    expect(must(row)).toMatchObject({ version: 1, answers: { Q6: 2 } });
    expect(await auditOf("response.edit")).toHaveLength(0);
  });

  it("a stale version gets the 'Someone else changed this' message and saves nothing", async () => {
    const vel = await seedBranch(env.db, "Velachery");
    const r = await seedResponse(vel, "JC-1", q6Answers());
    await signIn("branch_admin", vel);
    const res = await repo().editResponse(r.id, happyAnswers({ Q6: 4, Q12: 4, Q15: "No" }), 7, {
      password: PASSWORD,
    });
    expect(res).toMatchObject({ ok: false, error: { code: "CONFLICT", message: STALE } });
    const [row] = await env.db.select().from(responses).where(eq(responses.id, r.id));
    expect(must(row).answers).toMatchObject({ Q6: 2 });
  });

  it("S-08 Q12 1 -> 4 auto-resolves an only-reason alert; Q15 No -> Yes opens a new alert", async () => {
    const vel = await seedBranch(env.db, "Velachery");
    const r = await seedResponse(vel, "JC-1", happyAnswers({ Q12: 1, Q15: "No" }));
    const a = await seedAlert(r.id, vel, [{ kind: "low_rating", code: "Q12" }]);
    await signIn("branch_admin", vel);
    const done = await repo().editResponse(r.id, happyAnswers({ Q12: 4, Q15: "No" }), 1, {
      password: PASSWORD,
    });
    expect(done).toMatchObject({ ok: true, value: { alert: { status: "resolved" } } });
    const [after] = await env.db.select().from(alerts).where(eq(alerts.id, a.id));
    expect(must(after).status).toBe("resolved");
    expect(JSON.stringify(must(after).notes)).toContain(
      "Auto-resolved: no alert reason after edit",
    );
    expect(await auditOf("alert.status")).toHaveLength(1);

    const r2 = await seedResponse(vel, "JC-2", happyAnswers({ Q12: 4, Q15: "No" }));
    const made = await repo().editResponse(r2.id, happyAnswers({ Q12: 4, Q15: "Yes" }), 1, {
      password: PASSWORD,
    });
    expect(made).toMatchObject({ ok: true, value: { alert: { status: "open" } } });
    const created = await env.db.select().from(alerts).where(eq(alerts.responseId, r2.id));
    expect(created).toHaveLength(1);
    expect(must(created[0]).reasons).toEqual([{ kind: "callback" }]);
    expect(await auditOf("alert.create")).toHaveLength(1);
  });

  it("an edit that changes nothing writes no audit and keeps the version", async () => {
    const vel = await seedBranch(env.db, "Velachery");
    const r = await seedResponse(vel, "JC-1", q6Answers());
    await signIn("branch_admin", vel);
    const res = await repo().editResponse(r.id, q6Answers(), 1, { password: PASSWORD });
    expect(res).toMatchObject({ ok: true, value: { version: 1 } });
    expect(await auditOf("response.edit")).toHaveLength(0);
  });

  it("S-09 US-21 G-03 delete on 1 Dec 2026 is removed for good 31 Dec; restore brings back answers and alert; both audited", async () => {
    const vel = await seedBranch(env.db, "Velachery");
    const answers = happyAnswers({ Q12: 1, Q15: "No" });
    const r = await seedResponse(vel, "JC-1", answers);
    const a = await seedAlert(r.id, vel, [{ kind: "low_rating", code: "Q12" }]);
    await signIn("branch_admin", vel);
    env.clock.at = new Date("2026-12-01T06:30:00.000Z");

    const bad = await repo().deleteResponse(r.id, { password: "nope" });
    expect(bad).toMatchObject({ ok: false, error: { message: "Password incorrect" } });
    expect(await auditOf("response.delete")).toHaveLength(0);

    expect(await repo().deleteResponse(r.id, { password: PASSWORD })).toMatchObject({ ok: true });
    const list = await repo().listResponses(RANGE);
    expect(list.ok && list.value).toHaveLength(0);
    expect(await repo().getResponse(r.id)).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
    const del = await repo().listDeleted();
    expect(del.ok && del.value).toEqual([
      expect.objectContaining({ id: r.id, purgeOn: "2026-12-31", branchName: "Velachery" }),
    ]);

    expect(await repo().restoreResponse(r.id, { password: PASSWORD })).toMatchObject({ ok: true });
    const back = await repo().getResponse(r.id);
    expect(back).toMatchObject({
      ok: true,
      value: { response: { deletedAt: null, answers }, alert: { id: a.id, status: "open" } },
    });
    const deleted = await repo().listDeleted();
    expect(deleted.ok && deleted.value).toHaveLength(0);
    expect(await auditOf("response.delete")).toHaveLength(1);
    expect(await auditOf("response.restore")).toHaveLength(1);
  });

  it("US-29 another branch response is 'Not found' for every action, with no data", async () => {
    const vel = await seedBranch(env.db, "Velachery");
    const tam = await seedBranch(env.db, "Tambaram");
    const r = await seedResponse(vel, "JC-1", q6Answers());
    await env.db
      .update(responses)
      .set({ deletedAt: env.clock.now() })
      .where(eq(responses.id, r.id));
    const live = await seedResponse(vel, "JC-2", q6Answers());
    await signIn("branch_admin", tam);
    const notFound = { ok: false, error: { code: "NOT_FOUND", message: "Not found" } };
    expect(await repo().getResponse(live.id)).toMatchObject(notFound);
    expect(
      await repo().editResponse(live.id, q6Answers(), 1, { password: PASSWORD }),
    ).toMatchObject(notFound);
    expect(await repo().deleteResponse(live.id, { password: PASSWORD })).toMatchObject(notFound);
    expect(await repo().restoreResponse(r.id, { password: PASSWORD })).toMatchObject(notFound);
    expect(await repo().getResponse("not-a-uuid")).toMatchObject(notFound);
    const list = await repo().listResponses(RANGE);
    expect(list.ok && list.value).toHaveLength(0);
    const del = await repo().listDeleted();
    expect(del.ok && del.value).toHaveLength(0);
  });

  it("refuses support users; the main admin sees every branch", async () => {
    const vel = await seedBranch(env.db, "Velachery");
    await seedResponse(vel, "JC-1", q6Answers());
    await signIn("support", vel);
    expect(await repo().listResponses(RANGE)).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
    await signIn("main_admin", null);
    const all = await repo().listResponses(RANGE);
    expect(all.ok && all.value).toHaveLength(1);
  });

  it("does not leak an erased customer's name or phone", async () => {
    const vel = await seedBranch(env.db, "Velachery");
    const r = await seedResponse(vel, "JC-1", q6Answers());
    await env.db.update(jobCards).set({ erasedAt: env.clock.now() });
    await signIn("branch_admin", vel);
    const d = await repo().getResponse(r.id);
    expect(d).toMatchObject({
      ok: true,
      value: { jobCard: { customerName: "Erased customer", phone: null } },
    });
  });
});
