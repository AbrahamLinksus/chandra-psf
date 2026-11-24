// @vitest-environment node
/* eslint-disable max-lines-per-function -- describe blocks group many one-line tests */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { alerts, jobCards, rateLimits, responses, visits } from "@/server/db/schema";
import { hashCode } from "@/server/tokens";
import { makeServerCtx, must, seedBranch } from "../../../support/serverCtx";
import { happyAnswers, resend, seedLink, type Seeded } from "./harness";

vi.mock("server-only", () => ({}));

const { ServerFeedbackRepo } = await import("@/server/repos/feedback");

type Env = Awaited<ReturnType<typeof makeServerCtx>>;
let env: Env;
const NOW = new Date("2026-11-24T06:30:00.000Z");
const DAY = 86_400_000;
const SUB = "11111111-1111-4111-8111-111111111111";
const SUB2 = "22222222-2222-4222-8222-222222222222";

beforeEach(async () => {
  env = await makeServerCtx();
  env.clock.at = NOW;
});
afterEach(async () => {
  await env.client.close();
});

const repo = () => new ServerFeedbackRepo(env.ctx);
const link = (no = "JC-24-1042", branchId?: string): Promise<Seeded> =>
  seedLink(env.db, { no, now: NOW, branchId });
const state = async (code: string) => {
  const r = await repo().getVisitByToken(code);
  if (!r.ok) throw new Error(r.error.code);
  return r.value;
};
const visitRow = async (id: string) =>
  must((await env.db.select().from(visits).where(eq(visits.id, id)))[0]);
const storedAnswers = async () =>
  must((await env.db.select().from(responses))[0]).answers as Record<string, unknown>;

describe("getVisitByToken states", () => {
  it("open: ready with name, model, date and the questionnaire", async () => {
    const s = await link();
    expect(await state(s.code)).toMatchObject({
      state: "ready",
      visitId: s.visitId,
      customerName: "Ramesh Kumar",
      model: "Activa 6G",
      serviceDate: "2026-11-14",
    });
  });

  it("unknown code: invalid, and no counter row is created for it", async () => {
    expect(await state("nope-nope")).toEqual({ state: "invalid" });
    expect(await env.db.select().from(rateLimits)).toHaveLength(0);
  });

  it("past expiry: expired, not replaced", async () => {
    const s = await link();
    env.clock.advance(8 * DAY);
    expect(await state(s.code)).toEqual({ state: "expired", replaced: false });
  });

  it("superseded code (resend): expired with replaced = true", async () => {
    const s = await link();
    await resend(env.db, s, NOW);
    expect(await state(s.code)).toEqual({ state: "expired", replaced: true });
  });

  it("visit replaced by another visit: expired with replaced = true", async () => {
    const s = await link();
    const s2 = await link("JC-24-1043");
    await env.db.update(visits).set({ replacedBy: s2.visitId }).where(eq(visits.id, s.visitId));
    expect(await state(s.code)).toEqual({ state: "expired", replaced: true });
  });

  it("cancelled: invalid", async () => {
    const s = await link();
    await env.db.update(visits).set({ cancelledAt: NOW }).where(eq(visits.id, s.visitId));
    expect(await state(s.code)).toEqual({ state: "invalid" });
  });

  it("erased customer: invalid", async () => {
    const s = await link();
    await env.db.update(jobCards).set({ erasedAt: NOW }).where(eq(jobCards.id, s.cardId));
    expect(await state(s.code)).toEqual({ state: "invalid" });
  });

  it("submitted: completed", async () => {
    const s = await link();
    expect((await repo().submitResponse(s.code, happyAnswers(), SUB)).ok).toBe(true);
    expect(await state(s.code)).toEqual({ state: "completed" });
  });

  it("the 31st open of one link in an hour is rate_limited; a new hour resets", async () => {
    const s = await link();
    for (let i = 0; i < 30; i++) expect((await state(s.code)).state).toBe("ready");
    expect(await state(s.code)).toEqual({ state: "rate_limited" });
    env.clock.advance(3_600_000);
    expect((await state(s.code)).state).toBe("ready");
  });

  it("keeps the code out of the counter table (hash only)", async () => {
    const s = await link();
    await state(s.code);
    const rows = await env.db.select().from(rateLimits);
    expect(JSON.stringify(rows)).not.toContain(s.code);
    expect(Buffer.from(must(rows[0]).key).equals(hashCode(s.code))).toBe(true);
  });
});

describe("markOpened (AC-3)", () => {
  it("getVisitByToken alone does not set Opened", async () => {
    const s = await link();
    await state(s.code);
    expect((await visitRow(s.visitId)).openedAt).toBeNull();
  });

  it("sets Opened once and keeps the first time", async () => {
    const s = await link();
    expect((await repo().markOpened(s.code)).ok).toBe(true);
    expect((await visitRow(s.visitId)).openedAt).toEqual(NOW);
    env.clock.advance(60_000);
    await repo().markOpened(s.code);
    expect((await visitRow(s.visitId)).openedAt).toEqual(NOW);
  });

  it("is a silent ok no-op for unknown, expired, cancelled, completed and superseded links", async () => {
    expect((await repo().markOpened("nope")).ok).toBe(true);
    const exp = await link("JC-1");
    const can = await link("JC-2");
    const old = await link("JC-3");
    const done = await link("JC-4");
    await env.db.update(visits).set({ cancelledAt: NOW }).where(eq(visits.id, can.visitId));
    await env.db.update(visits).set({ completedAt: NOW }).where(eq(visits.id, done.visitId));
    await resend(env.db, old, NOW);
    env.clock.advance(8 * DAY);
    for (const s of [exp, can, old, done]) {
      expect((await repo().markOpened(s.code)).ok).toBe(true);
      expect((await visitRow(s.visitId)).openedAt).toBeNull();
    }
  });
});

describe("submitResponse", () => {
  it("Q12 = 1, Q15 = Yes: one response, callback true, the alert for the visit's branch", async () => {
    const other = await seedBranch(env.db, "Tambaram");
    await link("JC-9", other);
    const s = await link();
    const r = await repo().submitResponse(s.code, happyAnswers(), SUB);
    expect(r).toEqual({ ok: true, value: { callbackRequested: true } });
    const rows = await env.db.select().from(responses);
    expect(rows).toHaveLength(1);
    expect(must(rows[0]).visitId).toBe(s.visitId);
    expect(must(rows[0]).submissionId).toBe(SUB);
    const al = await env.db.select().from(alerts);
    expect(al).toHaveLength(1);
    expect(must(al[0]).branchId).toBe(s.branchId);
    expect(must(al[0]).branchId).not.toBe(other);
    expect(must(al[0]).responseId).toBe(must(rows[0]).id);
    expect(must(al[0]).reasons).toEqual([
      { kind: "callback" },
      { kind: "low_rating", code: "Q12" },
    ]);
    const v = await visitRow(s.visitId);
    expect(v.completedAt).toEqual(NOW);
    expect(v.openedAt).toEqual(NOW);
  });

  it("no alert and callbackRequested false for a happy customer", async () => {
    const s = await link();
    const r = await repo().submitResponse(s.code, happyAnswers({ Q12: 5, Q15: "No" }), SUB);
    expect(r).toEqual({ ok: true, value: { callbackRequested: false } });
    expect(await env.db.select().from(alerts)).toHaveLength(0);
  });

  it("an incomplete submit is VALIDATION with the missing codes and stores nothing", async () => {
    const s = await link();
    const r = await repo().submitResponse(s.code, happyAnswers({ Q12: undefined }), SUB);
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    expect(JSON.stringify(r)).toContain("Q12");
    expect(await env.db.select().from(responses)).toHaveLength(0);
    expect((await visitRow(s.visitId)).completedAt).toBeNull();
  });

  it("text over 1,000 characters is rejected; exactly 1,000 is accepted", async () => {
    const s = await link();
    const bad = await repo().submitResponse(s.code, happyAnswers({ Q14: "x".repeat(1001) }), SUB);
    expect(bad).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    expect(JSON.stringify(bad)).toContain("Q14");
    expect(await env.db.select().from(responses)).toHaveLength(0);
    const good = await repo().submitResponse(s.code, happyAnswers({ Q14: "x".repeat(1000) }), SUB);
    expect(good.ok).toBe(true);
  });

  it("hidden follow-ups never reach the database (Q1 = 5 hides Q1a; dropped, not an error)", async () => {
    const s = await link();
    const r = await repo().submitResponse(
      s.code,
      happyAnswers({ Q1a: "Problem not fixed", Q7a: "1 day late", Q2a: "x".repeat(5000) }),
      SUB,
    );
    expect(r.ok).toBe(true);
    const stored = await storedAnswers();
    for (const k of ["Q1a", "Q7a", "Q2a"]) expect(stored).not.toHaveProperty(k);
  });

  it("a visible follow-up over 1,000 characters is rejected (Q2 = No shows Q2a)", async () => {
    const s = await link();
    const r = await repo().submitResponse(
      s.code,
      happyAnswers({ Q2: "No", Q2a: "y".repeat(1001) }),
      SUB,
    );
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
  });

  it("<script> text is stored verbatim as data (rendering escapes it)", async () => {
    const s = await link();
    await repo().submitResponse(s.code, happyAnswers({ Q14: "<script>alert(1)</script>" }), SUB);
    expect((await storedAnswers()).Q14).toBe("<script>alert(1)</script>");
  });

  it("same submission id again: the same result, still one response and one alert", async () => {
    const s = await link();
    await repo().submitResponse(s.code, happyAnswers(), SUB);
    const again = await repo().submitResponse(s.code, happyAnswers(), SUB);
    expect(again).toEqual({ ok: true, value: { callbackRequested: true } });
    expect(await env.db.select().from(responses)).toHaveLength(1);
    expect(await env.db.select().from(alerts)).toHaveLength(1);
  });

  it("a different submission id after success: ALREADY_COMPLETED", async () => {
    const s = await link();
    await repo().submitResponse(s.code, happyAnswers(), SUB);
    const r = await repo().submitResponse(s.code, happyAnswers(), SUB2);
    expect(r).toMatchObject({ ok: false, error: { code: "ALREADY_COMPLETED" } });
    expect(await env.db.select().from(responses)).toHaveLength(1);
  });

  it("two contexts at once: one response, the other ALREADY_COMPLETED", async () => {
    const s = await link();
    const [a, b] = await Promise.all([
      new ServerFeedbackRepo(env.ctx).submitResponse(s.code, happyAnswers(), SUB),
      new ServerFeedbackRepo(env.ctx).submitResponse(s.code, happyAnswers({ Q12: 3 }), SUB2),
    ]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect(a.ok ? b : a).toMatchObject({ ok: false, error: { code: "ALREADY_COMPLETED" } });
    expect(await env.db.select().from(responses)).toHaveLength(1);
    expect(await env.db.select().from(alerts)).toHaveLength(1);
  });

  it("unknown, cancelled and erased links: NOT_FOUND 'Link not valid'", async () => {
    const can = await link("JC-2");
    const era = await link("JC-3");
    await env.db.update(visits).set({ cancelledAt: NOW }).where(eq(visits.id, can.visitId));
    await env.db.update(jobCards).set({ erasedAt: NOW }).where(eq(jobCards.id, era.cardId));
    for (const code of ["nope", can.code, era.code]) {
      expect(await repo().submitResponse(code, happyAnswers(), SUB)).toMatchObject({
        ok: false,
        error: { code: "NOT_FOUND", message: "Link not valid" },
      });
    }
  });

  it("expired and replaced links: CONFLICT, nothing stored", async () => {
    const old = await link("JC-3");
    const exp = await link("JC-4");
    await resend(env.db, old, NOW);
    env.clock.advance(8 * DAY);
    for (const s of [old, exp]) {
      expect(await repo().submitResponse(s.code, happyAnswers(), SUB)).toMatchObject({
        error: { code: "CONFLICT" },
      });
    }
    expect(await env.db.select().from(responses)).toHaveLength(0);
  });

  it("FLAG: without a submission id the server makes one up (no retry protection)", async () => {
    const s = await link();
    const r = await repo().submitResponse(s.code, happyAnswers());
    expect(r.ok).toBe(true);
    expect(must((await env.db.select().from(responses))[0]).submissionId).toMatch(
      /^[0-9a-f-]{36}$/,
    );
  });
});

describe("submit limits (S-22, G-7)", () => {
  it("the 6th submit on one link in an hour: RATE_LIMITED; a new hour resets", async () => {
    const s = await link();
    for (let i = 0; i < 5; i++) {
      const r = await repo().submitResponse(s.code, {}, SUB);
      expect(r).toMatchObject({ error: { code: "VALIDATION" } });
    }
    expect(await repo().submitResponse(s.code, happyAnswers(), SUB)).toMatchObject({
      ok: false,
      error: { code: "RATE_LIMITED", message: "Too many requests, try again in a few minutes" },
    });
    expect(await env.db.select().from(responses)).toHaveLength(0);
    env.clock.advance(3_600_000);
    expect((await repo().submitResponse(s.code, happyAnswers(), SUB)).ok).toBe(true);
  });

  it("the limit is per link: another link is unaffected", async () => {
    const a = await link("JC-1");
    const b = await link("JC-2");
    for (let i = 0; i < 6; i++) await repo().submitResponse(a.code, {}, SUB);
    expect((await repo().submitResponse(b.code, happyAnswers(), SUB)).ok).toBe(true);
  });

  it("junk codes create no counter rows", async () => {
    await repo().submitResponse("junk", happyAnswers(), SUB);
    expect(await env.db.select().from(rateLimits)).toHaveLength(0);
  });
});
