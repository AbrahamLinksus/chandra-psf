// @vitest-environment node
/* eslint-disable max-lines-per-function -- describe blocks group many one-line tests */
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { QUESTIONNAIRE_V2 } from "@/domain/questionnaire";
import {
  advisors,
  alerts,
  auditLog,
  jobCards,
  loginAttempts,
  questionnaires,
  rateLimits,
  responses,
  sessions,
  visits,
} from "@/server/db/schema";
import { runDailyCleanup } from "@/server/jobs/cleanup";
import { makeServerCtx, must, seedBranch, seedUser } from "../../../support/serverCtx";

vi.mock("server-only", () => ({}));

type Env = Awaited<ReturnType<typeof makeServerCtx>>;
const FAKE_SECRET = "a".repeat(40);
const holder: { db: Env["db"] | null; secret: string | undefined } = {
  db: null,
  secret: FAKE_SECRET,
};
vi.mock("@/server/env", () => ({ getServerEnv: () => ({ CRON_SECRET: holder.secret }) }));
vi.mock("@/server/db/client", async (orig) => ({
  ...(await orig<typeof import("@/server/db/client")>()),
  getDb: () => Promise.resolve(holder.db),
}));

let env: Env;
const NOW = new Date("2027-02-12T06:00:00Z");

beforeEach(async () => {
  env = await makeServerCtx();
  env.clock.at = NOW;
  holder.db = env.db;
  holder.secret = FAKE_SECRET;
});
afterEach(async () => {
  await env.client.close();
});

let seq = 0;
async function card(
  branchId: string,
  serviceDate: string,
  o: { answered?: boolean; deletedAt?: Date } = {},
) {
  seq += 1;
  const [adv] = await env.db
    .insert(advisors)
    .values({ branchId, name: `Adv ${String(seq)}` })
    .returning();
  const by = await seedUser(env.db, { role: "support", branchId });
  const [c] = await env.db
    .insert(jobCards)
    .values({
      branchId,
      jobCardNo: `JC${String(seq)}`,
      jobCardKey: `JC${String(seq)}`,
      customerName: "Asha Raman",
      phone: "9840012345",
      phoneKey: "9840012345",
      regNo: `TN01AB${String(1000 + seq)}`,
      regNoKey: `TN01AB${String(1000 + seq)}`,
      model: "Activa",
      vehicleType: "scooter",
      advisorId: must(adv).id,
      serviceType: "Paid service",
      serviceDate,
      createdBy: by,
    })
    .returning();
  const [v] = await env.db
    .insert(visits)
    .values({
      jobCardId: must(c).id,
      branchId,
      createdBy: by,
      createdAt: new Date(`${serviceDate}T05:00:00Z`),
      expiresAt: new Date(`${serviceDate}T05:00:00Z`),
      ...(o.answered ? { completedAt: new Date(`${serviceDate}T06:00:00Z`) } : {}),
    })
    .returning();
  await env.db
    .insert(questionnaires)
    .values({ version: QUESTIONNAIRE_V2.version, definition: QUESTIONNAIRE_V2 })
    .onConflictDoNothing();
  let responseId: string | null = null;
  if (o.deletedAt) {
    const [r] = await env.db
      .insert(responses)
      .values({
        visitId: must(v).id,
        questionsVersion: 2,
        answers: { Q2a: "call me on 9840012345" },
        submissionId: crypto.randomUUID(),
        deletedAt: o.deletedAt,
      })
      .returning();
    responseId = must(r).id;
  }
  return { id: must(c).id, responseId };
}

const erasedAt = async (id: string) =>
  must((await env.db.select().from(jobCards).where(eq(jobCards.id, id)))[0]).erasedAt;
const run = (opts = {}) => runDailyCleanup(env.db, env.clock, opts);
const hoursAgo = (n: number) => new Date(NOW.getTime() - n * 3_600_000);

describe("retention (US-31)", () => {
  it("s31 erases the unanswered visit served 14 Nov 2026 on 12 Feb 2027 and keeps the answered one", async () => {
    const b = await seedBranch(env.db, "Adyar");
    const un = await card(b, "2026-11-14");
    const ans = await card(b, "2026-11-14", { answered: true });
    const counts = await run();
    expect(await erasedAt(un.id)).not.toBeNull();
    expect(await erasedAt(ans.id)).toBeNull();
    expect(counts.unansweredErased).toBe(1);
    expect(counts.answeredErased).toBe(0);
  });

  it("the erase date is inclusive: 14 Nov goes, 15 Nov stays", async () => {
    const b = await seedBranch(env.db, "Adyar");
    const due = await card(b, "2026-11-14");
    const notYet = await card(b, "2026-11-15");
    await run();
    expect(await erasedAt(due.id)).not.toBeNull();
    expect(await erasedAt(notYet.id)).toBeNull();
  });

  it("an answered visit is erased when 3 years old (inclusive), not before", async () => {
    const b = await seedBranch(env.db, "Adyar");
    const due = await card(b, "2024-02-12", { answered: true });
    const notYet = await card(b, "2024-02-13", { answered: true });
    await run();
    expect(await erasedAt(due.id)).not.toBeNull();
    expect(await erasedAt(notYet.id)).toBeNull();
  });
});

describe("purge of deleted responses", () => {
  it("purges a response deleted 1 Dec 2026 on 31 Dec (not 30 Dec); the response.purge audit holds no answers", async () => {
    const b = await seedBranch(env.db, "Adyar");
    const c = await card(b, "2026-11-30", {
      answered: true,
      deletedAt: new Date("2026-12-01T00:00:00Z"),
    });
    const rid = must(c.responseId);
    await env.db.insert(alerts).values({ responseId: rid, branchId: b, reasons: [], notes: [] });

    env.clock.at = new Date("2026-12-30T12:00:00Z");
    expect((await run()).responsesPurged).toBe(0);
    expect(await env.db.select().from(responses)).toHaveLength(1);

    env.clock.at = new Date("2026-12-31T12:00:00Z");
    expect((await run()).responsesPurged).toBe(1);
    expect(await env.db.select().from(responses)).toHaveLength(0);
    expect(await env.db.select().from(alerts)).toHaveLength(0);
    const audit = await env.db.select().from(auditLog).where(eq(auditLog.action, "response.purge"));
    expect(audit).toHaveLength(1);
    expect(must(audit[0]).entityId).toBe(rid);
    expect(JSON.stringify(audit[0])).not.toContain("9840012345");
    expect(must(audit[0]).newValue).toBeNull();
  });
});

describe("sessions, attempts, limits (G-11)", () => {
  it("removes expired sessions only", async () => {
    const admin = await seedUser(env.db, { role: "main_admin" });
    const br = await seedBranch(env.db, "Adyar");
    const sup = await seedUser(env.db, { role: "support", branchId: br });
    const h = (n: number) => Buffer.from([n]);
    await env.db.insert(sessions).values([
      { idHash: h(1), userId: admin, createdAt: hoursAgo(1), lastActiveAt: hoursAgo(1) },
      { idHash: h(2), userId: admin, createdAt: hoursAgo(24 * 8), lastActiveAt: hoursAgo(1) },
      { idHash: h(3), userId: admin, createdAt: hoursAgo(20), lastActiveAt: hoursAgo(13) },
      { idHash: h(4), userId: sup, createdAt: hoursAgo(5), lastActiveAt: hoursAgo(3) },
      { idHash: h(5), userId: sup, createdAt: hoursAgo(5), lastActiveAt: hoursAgo(1) },
    ]);
    expect((await run()).sessionsRemoved).toBe(3);
    const left = (await env.db.select().from(sessions)).map((s) => s.idHash[0]).sort();
    expect(left).toEqual([1, 5]);
  });

  it("removes login attempts and rate limits older than 24 h, keeps fresh ones", async () => {
    const ip = Buffer.from([9]);
    await env.db.insert(loginAttempts).values([
      { emailKey: "a@x.in", ipHash: ip, at: hoursAgo(25), kind: "signin" },
      { emailKey: "a@x.in", ipHash: ip, at: hoursAgo(23), kind: "signin" },
    ]);
    await env.db.insert(rateLimits).values([
      { bucket: "feedback", key: ip, windowStart: hoursAgo(30), count: 3 },
      { bucket: "feedback", key: ip, windowStart: hoursAgo(1), count: 1 },
    ]);
    const counts = await run();
    expect(counts.attemptsRemoved).toBe(1);
    expect(counts.limitsRemoved).toBe(1);
    expect(await env.db.select().from(loginAttempts)).toHaveLength(1);
    expect(await env.db.select().from(rateLimits)).toHaveLength(1);
  });
});

describe("audit, idempotence, budget", () => {
  it("writes one system.cleanup audit with counts; a second run changes nothing", async () => {
    const b = await seedBranch(env.db, "Adyar");
    await card(b, "2026-11-14");
    const first = await run();
    const cleanupAudits = () =>
      env.db.select().from(auditLog).where(eq(auditLog.action, "system.cleanup"));
    const a1 = await cleanupAudits();
    expect(a1).toHaveLength(1);
    expect(must(a1[0]).newValue).toMatchObject({ unansweredErased: 1 });
    expect(first.unansweredErased).toBe(1);

    const others = async () =>
      (await env.db.select().from(auditLog)).filter((r) => r.action !== "system.cleanup").length;
    const before = await others();
    const second = await run();
    expect(second).toMatchObject({
      unansweredErased: 0,
      answeredErased: 0,
      responsesPurged: 0,
      sessionsRemoved: 0,
      attemptsRemoved: 0,
      limitsRemoved: 0,
    });
    expect(await others()).toBe(before);
  });

  it("stops batches at the budget and the next run continues", async () => {
    const b = await seedBranch(env.db, "Adyar");
    const c = await card(b, "2026-11-14");
    let calls = 0;
    const exhausted = await run({ elapsedMs: () => (calls++ === 0 ? 0 : 241_000) });
    expect(exhausted.stoppedEarly).toBe(true);
    expect(exhausted.unansweredErased).toBe(0);
    expect(await erasedAt(c.id)).toBeNull();

    const next = await run();
    expect(next.stoppedEarly).toBe(false);
    expect(next.unansweredErased).toBe(1);
    expect(await erasedAt(c.id)).not.toBeNull();
  });
});

describe("GET /api/cron/daily", () => {
  const call = async (auth?: string) => {
    const { GET } = await import("@/app/api/cron/daily/route");
    const init = auth === undefined ? {} : { headers: { authorization: auth } };
    return GET(new Request("http://localhost/api/cron/daily", init));
  };

  it("401 without a header", async () => {
    expect((await call()).status).toBe(401);
  });
  it("401 with a wrong secret", async () => {
    expect((await call(`Bearer ${"b".repeat(40)}`)).status).toBe(401);
  });
  it("401 with a short secret and without the Bearer prefix", async () => {
    expect((await call("Bearer a")).status).toBe(401);
    expect((await call(FAKE_SECRET)).status).toBe(401);
  });
  it("401 when no secret is configured, whatever is sent", async () => {
    holder.secret = undefined;
    expect((await call("Bearer ")).status).toBe(401);
    expect((await call("Bearer undefined")).status).toBe(401);
  });
  it("200 with counts for the right secret, and writes the audit", async () => {
    const res = await call(`Bearer ${FAKE_SECRET}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ unansweredErased: 0, stoppedEarly: false });
    const a = await env.db.select().from(auditLog).where(eq(auditLog.action, "system.cleanup"));
    expect(a).toHaveLength(1);
  });
});

describe("vercel.json", () => {
  it("schedules /api/cron/daily at 30 21 * * *", () => {
    const cfg = JSON.parse(readFileSync("vercel.json", "utf8")) as {
      crons: { path: string; schedule: string }[];
    };
    expect(cfg.crons).toContainEqual({ path: "/api/cron/daily", schedule: "30 21 * * *" });
  });
});
