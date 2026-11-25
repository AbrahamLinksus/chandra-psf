// @vitest-environment node
/* eslint-disable max-lines-per-function -- describe blocks group many one-line tests */
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { clearFeedback, type AdminDeps } from "../../../../scripts/admin";
import { writeAudit } from "../../../../src/server/audit";
import {
  advisors,
  alerts,
  auditLog,
  branches,
  erasureJournal,
  jobCards,
  linkTokens,
  questionnaires,
  rateLimits,
  responses,
  users,
  visits,
} from "../../../../src/server/db/schema";
import { createTestDb } from "../../../support/pglite";
import { seedLink } from "../feedback/harness";

vi.mock("server-only", () => ({}));

const NOW = new Date("2026-12-01T09:00:00.000Z");

function one<T>(v: T | undefined): T {
  if (v === undefined) throw new Error("expected a row");
  return v;
}

let deps: AdminDeps;
const open: PGlite[] = [];

beforeEach(async () => {
  const t = await createTestDb();
  open.push(t.client);
  deps = { db: t.db, now: () => NOW };
});
afterAll(async () => {
  await Promise.all(open.map((c) => c.close()));
});

describe("clearFeedback (CR-2, F-9)", () => {
  const counts = async () => ({
    alerts: (await deps.db.select().from(alerts)).length,
    responses: (await deps.db.select().from(responses)).length,
    links: (await deps.db.select().from(linkTokens)).length,
    visits: (await deps.db.select().from(visits)).length,
    versions: (await deps.db.select().from(questionnaires)).map((q) => q.version),
    branches: (await deps.db.select().from(branches)).length,
    advisors: (await deps.db.select().from(advisors)).length,
    users: (await deps.db.select().from(users)).length,
    cards: (await deps.db.select().from(jobCards)).length,
    audit: (await deps.db.select().from(auditLog)).length,
    journal: (await deps.db.select().from(erasureJournal)).length,
    limits: (await deps.db.select().from(rateLimits)).length,
  });

  async function seedV1Feedback(): Promise<void> {
    const s = await seedLink(deps.db, { no: "JC-CLR-1", now: NOW });
    await deps.db.insert(questionnaires).values({ version: 1, definition: {} });
    const [r] = await deps.db
      .insert(responses)
      .values({
        visitId: s.visitId,
        questionsVersion: 1,
        answers: { Q12: 1, Q14: "old comment" },
        submissionId: crypto.randomUUID(),
      })
      .returning();
    await deps.db
      .insert(alerts)
      .values({ responseId: one(r).id, branchId: s.branchId, reasons: [{ kind: "callback" }] });
    await deps.db
      .insert(erasureJournal)
      .values({ jobCardId: crypto.randomUUID(), source: "request" });
    await writeAudit({ session: null, clock: { now: () => NOW } }, deps.db, {
      action: "branch.create",
      entityType: "branch",
      entityId: s.branchId,
    });
  }

  it("without the confirm flag it refuses and changes nothing", async () => {
    await seedV1Feedback();
    const before = await counts();
    await expect(clearFeedback(deps, { confirm: false, env: {} })).rejects.toThrow(/confirm/);
    expect(await counts()).toEqual(before);
  });

  it("refuses on production even with the flag", async () => {
    await seedV1Feedback();
    const before = await counts();
    await expect(
      clearFeedback(deps, { confirm: true, env: { VERCEL_ENV: "production" } }),
    ).rejects.toThrow(/production/);
    expect(await counts()).toEqual(before);
  });

  it("with the flag it deletes feedback and v1, installs v2, keeps the rest, audits once", async () => {
    await seedV1Feedback();
    await deps.db
      .insert(questionnaires)
      .values({ version: 1, definition: {} })
      .onConflictDoNothing();
    const before = await counts();
    expect(before.alerts).toBe(1);
    const result = await clearFeedback(deps, { confirm: true, env: {} });
    expect(result).toMatchObject({ alerts: 1, responses: 1, linkTokens: 1, visits: 1 });
    const after = await counts();
    expect(after).toMatchObject({ alerts: 0, responses: 0, links: 0, visits: 0, versions: [2] });
    expect(after).toMatchObject({
      branches: before.branches,
      advisors: before.advisors,
      users: before.users,
      cards: before.cards,
      journal: before.journal,
    });
    expect(after.cards).toBe(1);
    expect(after.journal).toBe(1);
    const audit = await deps.db.select().from(auditLog);
    expect(audit).toHaveLength(before.audit + 1);
    expect(audit.filter((a) => a.action === "system.cleanup")).toHaveLength(1);
  });
});
