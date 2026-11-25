// @vitest-environment node
/* eslint-disable max-lines-per-function -- describe blocks group several tests */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { advisors, alerts, jobCards, questionnaires, responses, visits } from "@/server/db/schema";
import { QUESTIONNAIRE_V2 } from "@/domain/questionnaire";
import type { SessionUser } from "@/server/ctx";
import { makeServerCtx, must, seedBranch, seedUser } from "../../../support/serverCtx";

vi.mock("server-only", () => ({}));
const { ServerAnalyticsRepo } = await import("@/server/repos/analytics");

type Env = Awaited<ReturnType<typeof makeServerCtx>>;
let env: Env;
beforeEach(async () => {
  env = await makeServerCtx();
  await env.db
    .insert(questionnaires)
    .values({ version: QUESTIONNAIRE_V2.version, definition: QUESTIONNAIRE_V2 });
});
afterEach(async () => {
  await env.client.close();
});

const repo = () => new ServerAnalyticsRepo(env.ctx);
const RANGE = { from: "2026-11-01", to: "2026-11-30" };

function signIn(user: Pick<SessionUser, "id" | "role"> & Partial<SessionUser>): void {
  env.ctx.session = {
    sessionId: "s",
    createdAt: env.clock.now(),
    lastActiveAt: env.clock.now(),
    user: { name: "Meena", email: "m@chandra.in", branchId: null, mustSetPassword: false, ...user },
  };
}

interface Branch {
  id: string;
  advisorId: string;
  userId: string;
}

async function newBranch(name: string): Promise<Branch> {
  const id = await seedBranch(env.db, name);
  const userId = await seedUser(env.db, { role: "support", branchId: id });
  const [adv] = await env.db
    .insert(advisors)
    .values({ branchId: id, name: `Adv ${name}` })
    .returning();
  return { id, advisorId: must(adv).id, userId };
}

/** `total` visits on job cards dated `serviceDate`; the first `done` are completed with a response. */
async function seedVisits(
  b: Branch,
  o: { total: number; done: number; serviceDate?: string; tag: string; answers?: object },
) {
  const out: { visitId: string; responseId: string | null }[] = [];
  for (let i = 0; i < o.total; i++) {
    const key = `${o.tag}${String(i)}`;
    const [card] = await env.db
      .insert(jobCards)
      .values({
        branchId: b.id,
        jobCardNo: key,
        jobCardKey: key,
        customerName: "Ramesh Kumar",
        phone: "+919840012345",
        regNo: key,
        regNoKey: key,
        model: "Activa 6G",
        vehicleType: "scooter",
        advisorId: b.advisorId,
        serviceType: "Paid service",
        serviceDate: o.serviceDate ?? "2026-11-14",
        createdBy: b.userId,
      })
      .returning();
    const completed = i < o.done;
    const [v] = await env.db
      .insert(visits)
      .values({
        jobCardId: must(card).id,
        branchId: b.id,
        createdBy: b.userId,
        expiresAt: new Date("2027-01-01"),
        completedAt: completed ? env.clock.now() : null,
      })
      .returning();
    let responseId: string | null = null;
    if (completed) {
      const [r] = await env.db
        .insert(responses)
        .values({
          visitId: must(v).id,
          questionsVersion: 2,
          answers: o.answers ?? { Q12: 4, Q13: "Yes" },
          submissionId: crypto.randomUUID(),
        })
        .returning();
      responseId = must(r).id;
    }
    out.push({ visitId: must(v).id, responseId });
  }
  return out;
}

const asMain = async () => {
  signIn({ id: await seedUser(env.db, { role: "main_admin" }), role: "main_admin" });
};
const asBranchAdmin = async (b: Branch) => {
  signIn({
    id: await seedUser(env.db, { role: "branch_admin", branchId: b.id }),
    role: "branch_admin",
    branchId: b.id,
  });
};

describe("analytics repo (T-06b)", () => {
  it("S-30 / the branch admin's response rate is their branch's; the main admin's follows the Branch filter", async () => {
    const vel = await newBranch("Velachery");
    const tam = await newBranch("Tambaram");
    await seedVisits(vel, { total: 40, done: 30, tag: "V" });
    await seedVisits(tam, { total: 10, done: 5, tag: "T" });

    await asBranchAdmin(vel);
    const mine = await repo().getAnalytics(RANGE);
    expect(mine.ok && mine.value.kpis.responseRate.value).toBe(75);
    // a branch admin cannot widen the scope with branchId
    const peek = await repo().getAnalytics({ ...RANGE, branchId: tam.id });
    expect(peek.ok && peek.value.kpis.responseRate.value).toBe(75);

    await asMain();
    const all = await repo().getAnalytics(RANGE);
    expect(all.ok && all.value.kpis.responseRate.value).toBe(70);
    const one = await repo().getAnalytics({ ...RANGE, branchId: tam.id });
    expect(one.ok && one.value.kpis.responseRate.value).toBe(50);
  });

  it("S-30 / Branch filter options exist only for the main admin; advisors follow the branch", async () => {
    const vel = await newBranch("Velachery");
    const tam = await newBranch("Tambaram");
    await asBranchAdmin(vel);
    const bo = await repo().getFilterOptions();
    expect(bo.ok && bo.value.branches).toBeUndefined();
    expect(bo.ok && bo.value.advisors.map((a) => a.id)).toEqual([vel.advisorId]);

    await asMain();
    const all = await repo().getFilterOptions();
    expect(all.ok && all.value.branches?.length).toBe(2);
    expect(all.ok && all.value.advisors).toHaveLength(2);
    const t = await repo().getFilterOptions({ branchId: tam.id });
    expect(t.ok && t.value.advisors.map((a) => a.id)).toEqual([tam.advisorId]);
  });

  it("S-10 / launch day with no responses: every number is empty, no arrows", async () => {
    const vel = await newBranch("Velachery");
    await asBranchAdmin(vel);
    const r = await repo().getAnalytics(RANGE);
    if (!r.ok) throw new Error("expected ok");
    const k = r.value.kpis;
    for (const m of [k.responses, k.responseRate, k.avgQ12, k.recommendRate]) {
      expect(m).toEqual({ value: null, previous: null, delta: null });
    }
    expect(k.openAlerts).toBe(0);
    expect(r.value.advisors).toEqual([]);
    expect(r.value.comments).toEqual([]);
    expect(r.value.categoryScores.every((c) => c.score === null)).toBe(true);
  });

  it("S-09 / Open alerts excludes the alerts of deleted responses", async () => {
    const vel = await newBranch("Velachery");
    const rows = await seedVisits(vel, { total: 2, done: 2, tag: "A" });
    for (const row of rows) {
      await env.db.insert(alerts).values({
        responseId: must(row.responseId),
        branchId: vel.id,
        reasons: [{ kind: "callback" }],
        notes: [],
      });
    }
    await asBranchAdmin(vel);
    const before = await repo().getAnalytics(RANGE);
    expect(before.ok && before.value.kpis.openAlerts).toBe(2);
    await env.db
      .update(responses)
      .set({ deletedAt: env.clock.now() })
      .where(eq(responses.id, must(rows[0]?.responseId)));
    const after = await repo().getAnalytics(RANGE);
    expect(after.ok && after.value.kpis.openAlerts).toBe(1);
    expect(after.ok && after.value.kpis.responses.value).toBe(1);
  });

  it("S-11 / the blocks filter on the service date, not on when the feedback came in", async () => {
    const vel = await newBranch("Velachery");
    await seedVisits(vel, { total: 3, done: 3, tag: "IN", serviceDate: "2026-11-14" });
    await seedVisits(vel, { total: 2, done: 2, tag: "OUT", serviceDate: "2026-09-01" });
    await asBranchAdmin(vel);
    // every response was submitted "now" (March 2026 clock): only the service date puts them in range
    const r = await repo().getAnalytics(RANGE);
    expect(r.ok && r.value.kpis.responses.value).toBe(3);
    expect(r.ok && r.value.kpis.responseRate.value).toBe(100);
  });

  it("AC-6 / Support is FORBIDDEN from getAnalytics and getFilterOptions", async () => {
    const vel = await newBranch("Velachery");
    signIn({ id: vel.userId, role: "support", branchId: vel.id });
    const a = await repo().getAnalytics(RANGE);
    expect(a).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    const o = await repo().getFilterOptions();
    expect(o).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  });

  it("AC-6 / no session is UNAUTHENTICATED", async () => {
    expect(await repo().getAnalytics(RANGE)).toMatchObject({
      ok: false,
      error: { code: "UNAUTHENTICATED" },
    });
  });

  it("anonymised responses (comments gone) are still counted", async () => {
    const vel = await newBranch("Velachery");
    await seedVisits(vel, { total: 4, done: 4, tag: "N", answers: {} });
    await asBranchAdmin(vel);
    const r = await repo().getAnalytics(RANGE);
    expect(r.ok && r.value.kpis.responses.value).toBe(4);
    expect(r.ok && r.value.kpis.responseRate.value).toBe(100);
    expect(r.ok && r.value.comments).toEqual([]);
  });
});
