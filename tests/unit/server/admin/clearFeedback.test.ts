// @vitest-environment node
/* eslint-disable max-lines-per-function -- describe blocks group many one-line tests */
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { clearFeedback, type AdminDeps } from "../../../../scripts/admin";
import { ClearRefused, databaseHostOf } from "../../../../scripts/adminClear";
import { parseCli } from "../../../../scripts/adminCli";
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
const HOST = { expectedHost: "pglite", actualHost: "pglite" };

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
    await expect(clearFeedback(deps, { confirm: false, ...HOST, env: {} })).rejects.toThrow(
      /confirm/,
    );
    expect(await counts()).toEqual(before);
  });

  it("refuses on production even with the flag", async () => {
    await seedV1Feedback();
    const before = await counts();
    await expect(
      clearFeedback(deps, { confirm: true, ...HOST, env: { VERCEL_ENV: "production" } }),
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
    const result = await clearFeedback(deps, { confirm: true, ...HOST, env: {} });
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

  const NEON =
    "postgres://neondb_owner:s3cretPW@ep-cool-123.eu-west-2.aws.neon.tech/neondb?sslmode=require";

  it("a wrong --database-host refuses, names the expected host only, deletes nothing", async () => {
    await seedV1Feedback();
    const before = await counts();
    const actualHost = databaseHostOf(NEON);
    const err = await clearFeedback(deps, {
      confirm: true,
      expectedHost: "other-host.example.com",
      actualHost,
      env: {},
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ClearRefused);
    const msg = (err as Error).message;
    expect(msg).toContain("ep-cool-123.eu-west-2.aws.neon.tech");
    expect(msg).not.toContain("s3cretPW");
    expect(msg).not.toContain("neondb_owner");
    expect(msg).not.toContain("postgres://");
    expect(await counts()).toEqual(before);
  });

  it("a missing --database-host refuses and deletes nothing", async () => {
    await seedV1Feedback();
    const before = await counts();
    await expect(
      clearFeedback(deps, {
        confirm: true,
        expectedHost: undefined,
        actualHost: "pglite",
        env: {},
      }),
    ).rejects.toBeInstanceOf(ClearRefused);
    expect(await counts()).toEqual(before);
  });

  it("an empty --database-host refuses", async () => {
    await expect(
      clearFeedback(deps, { confirm: true, expectedHost: "", actualHost: "pglite", env: {} }),
    ).rejects.toBeInstanceOf(ClearRefused);
  });

  it("a matching Neon host clears", async () => {
    await seedV1Feedback();
    const host = databaseHostOf(NEON);
    const r = await clearFeedback(deps, {
      confirm: true,
      expectedHost: host,
      actualHost: host,
      env: {},
    });
    expect(r.visits).toBe(1);
  });
});

describe("databaseHostOf and parseCli (D-50)", () => {
  it("extracts the host from a Neon-style URL, without user or password", () => {
    expect(databaseHostOf("postgres://u:pw@ep-x-1.neon.tech/db?sslmode=require")).toBe(
      "ep-x-1.neon.tech",
    );
  });
  it("returns pglite for pglite: URLs", () => {
    expect(databaseHostOf("pglite:memory")).toBe("pglite");
    expect(databaseHostOf("pglite:./data/dev")).toBe("pglite");
  });
  it("refuses an unparseable URL without echoing it", () => {
    expect.assertions(2);
    try {
      databaseHostOf("not a url with secret");
    } catch (e) {
      expect(e).toBeInstanceOf(ClearRefused);
      expect((e as Error).message).not.toContain("secret");
    }
  });
  it("parseCli reads --database-host and the confirm flag", () => {
    const { values, positionals } = parseCli([
      "clear-feedback",
      "--database-host",
      "h.example",
      "--confirm-delete-all-feedback",
    ]);
    expect(positionals).toEqual(["clear-feedback"]);
    expect(values["database-host"]).toBe("h.example");
    expect(values["confirm-delete-all-feedback"]).toBe(true);
  });
  it("parseCli leaves database-host undefined when absent", () => {
    expect(parseCli(["clear-feedback"]).values["database-host"]).toBeUndefined();
  });
});
