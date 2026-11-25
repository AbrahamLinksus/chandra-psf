// @vitest-environment node
/* eslint-disable max-lines-per-function -- one scenario per test */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { QUESTIONNAIRE_V2 } from "@/domain/questionnaire";
import {
  advisors,
  alerts,
  auditLog,
  jobCards,
  questionnaires,
  responses,
  visits,
} from "@/server/db/schema";
import { writeAudit } from "@/server/audit";
import { eraseJobCards } from "@/server/erasure";
import { runDailyCleanup } from "@/server/jobs/cleanup";
import { makeServerCtx, must, seedBranch, seedUser } from "../../../support/serverCtx";

vi.mock("server-only", () => ({}));

type Env = Awaited<ReturnType<typeof makeServerCtx>>;
const Q14_OLD = "old: engine noise, ring Gopal on 9840099999";
const Q14_NEW = "new: engine noise, ring Gopal on 9840099999";
const NOTE = "called Gopal Iyer about brake";
let env: Env;

beforeEach(async () => {
  env = await makeServerCtx();
});
afterEach(async () => {
  await env.client.close();
});

async function seedResponse(branchId: string, no: string, deletedAt: Date | null) {
  const [adv] = await env.db
    .insert(advisors)
    .values({ branchId, name: `A${no}` })
    .returning();
  const by = await seedUser(env.db, { role: "support", branchId });
  const [c] = await env.db
    .insert(jobCards)
    .values({
      branchId,
      jobCardNo: no,
      jobCardKey: no,
      customerName: "Gopal Iyer",
      phone: "9840099999",
      phoneKey: "9840099999",
      regNo: `TN01${no}`,
      regNoKey: `TN01${no}`,
      model: "Activa",
      vehicleType: "scooter",
      advisorId: must(adv).id,
      serviceType: "Paid service",
      serviceDate: "2026-11-30",
      createdBy: by,
    })
    .returning();
  await env.db
    .insert(questionnaires)
    .values({ version: QUESTIONNAIRE_V2.version, definition: QUESTIONNAIRE_V2 })
    .onConflictDoNothing();
  const [v] = await env.db
    .insert(visits)
    .values({
      jobCardId: must(c).id,
      branchId,
      createdBy: by,
      createdAt: new Date("2026-11-30T05:00:00Z"),
      expiresAt: new Date("2026-12-07T05:00:00Z"),
      completedAt: new Date("2026-11-30T06:00:00Z"),
    })
    .returning();
  const [r] = await env.db
    .insert(responses)
    .values({
      visitId: must(v).id,
      questionsVersion: 2,
      answers: { Q2a: Q14_NEW },
      submissionId: crypto.randomUUID(),
      deletedAt,
    })
    .returning();
  const [a] = await env.db
    .insert(alerts)
    .values({
      responseId: must(r).id,
      branchId,
      reasons: [],
      notes: [{ at: "2026-11-30T07:00:00Z", by: "Meena", text: NOTE }],
    })
    .returning();
  const stamp = { session: null, clock: env.clock };
  await writeAudit(stamp, env.db, {
    action: "response.edit",
    entityType: "response",
    entityId: must(r).id,
    oldValue: { Q2a: Q14_OLD },
    newValue: { Q2a: Q14_NEW },
    branchId,
  });
  await writeAudit(stamp, env.db, {
    action: "alert.note",
    entityType: "alert",
    entityId: must(a).id,
    note: NOTE,
    branchId,
  });
  return { card: must(c).id, response: must(r).id, alert: must(a).id };
}

const auditText = async () => JSON.stringify(await env.db.select().from(auditLog));
const auditFor = (id: string) => env.db.select().from(auditLog).where(eq(auditLog.entityId, id));

describe("purge redacts audit rows (M1)", () => {
  it("edit -> delete -> purge -> erase customer leaves no Q14 or note text in audit_log", async () => {
    const b = await seedBranch(env.db, "Adyar");
    const s = await seedResponse(b, "JC1", new Date("2026-12-01T00:00:00Z"));
    env.clock.at = new Date("2026-12-31T12:00:00Z");

    expect((await runDailyCleanup(env.db, env.clock)).responsesPurged).toBe(1);
    expect(await env.db.select().from(responses)).toHaveLength(0);

    // Redacted by the purge itself, before any customer erasure.
    const edit = must((await auditFor(s.response)).find((r) => r.action === "response.edit"));
    expect([edit.oldValue, edit.newValue]).toEqual(["[erased]", "[erased]"]);
    expect(must((await auditFor(s.alert))[0]).note).toBe("[erased]");
    expect((await auditFor(s.response)).some((r) => r.action === "response.purge")).toBe(true);

    await env.db.transaction((tx) => eraseJobCards(tx, [s.card], "request", env.clock.now()));
    const all = await auditText();
    for (const secret of [Q14_OLD, Q14_NEW, NOTE, "Gopal", "9840099999"]) {
      expect(all).not.toContain(secret);
    }
  });

  it("only the purged response's audit rows are redacted; other responses keep theirs", async () => {
    const b = await seedBranch(env.db, "Adyar");
    const gone = await seedResponse(b, "JC1", new Date("2026-12-01T00:00:00Z"));
    const live = await seedResponse(b, "JC2", null);
    env.clock.at = new Date("2026-12-31T12:00:00Z");
    await runDailyCleanup(env.db, env.clock);
    expect(JSON.stringify(await auditFor(gone.response))).not.toContain("engine noise");
    expect(JSON.stringify(await auditFor(live.response))).toContain(Q14_NEW);
    expect(must((await auditFor(live.alert))[0]).note).toBe(NOTE);
  });
});
