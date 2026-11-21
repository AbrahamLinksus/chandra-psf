/* eslint-disable max-lines-per-function -- describe blocks group many one-line tests */
import { describe, expect, it } from "vitest";
import seedJson from "@/data/seed/seed.json";
import { hashPassword } from "@/data/local/crypto";
import { rebaseSeed } from "@/data/local/seed";
import { SeedSchema, type Seed } from "@/domain/schemas";
import { addDays, daysBetween, istDateOf } from "@/domain/time";
import { visitStatus } from "@/domain/visitStatus";

const seed: Seed = SeedSchema.parse(seedJson);
// Midday IST on assorted days: a month end, a year start, a leap-year day and a recent day.
const DAYS = [
  "2026-02-28T06:30:00.000Z",
  "2027-01-01T06:30:00.000Z",
  "2028-03-01T06:30:00.000Z",
  "2026-11-21T06:30:00.000Z",
];
const DAY_MS = 86_400_000;

describe("rebaseSeed on any load day (S-07)", () => {
  it.each(DAYS)("service dates span the 3 months before %s", async (iso) => {
    const now = new Date(iso);
    const db = await rebaseSeed(seed, now, "pw");
    const today = istDateOf(now);
    const ages = db.jobCards.map((j) => daysBetween(j.serviceDate, today));
    expect(Math.min(...ages)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...ages)).toBeGreaterThanOrEqual(80);
    expect(Math.max(...ages)).toBeLessThanOrEqual(92);
  });

  it.each(DAYS)("the last 30 days before %s hold responses", async (iso) => {
    const now = new Date(iso);
    const db = await rebaseSeed(seed, now, "pw");
    const from = istDateOf(new Date(now.getTime() - 30 * DAY_MS));
    const recent = db.responses.filter((r) => istDateOf(r.submittedAt) >= from);
    expect(recent.length).toBeGreaterThanOrEqual(5);
  });

  it.each(DAYS)("on %s some links are still Created or Opened, some Expired", async (iso) => {
    const now = new Date(iso);
    const db = await rebaseSeed(seed, now, "pw");
    const status = db.visits.map((v) => visitStatus(v, now));
    for (const s of ["created", "opened", "expired", "completed"]) expect(status).toContain(s);
  });

  it("the same day gives the same result; another day moves the dates", async () => {
    const a = await rebaseSeed(seed, new Date(DAYS[0] ?? ""), "pw");
    const b = await rebaseSeed(seed, new Date(DAYS[0] ?? ""), "pw");
    const c = await rebaseSeed(seed, new Date(DAYS[1] ?? ""), "pw");
    const untokened = (d: typeof a) => d.visits.map((v) => ({ ...v, token: "" }));
    expect(untokened(b)).toEqual(untokened(a));
    expect({ ...b, visits: [] }).toEqual({ ...a, visits: [] });
    expect(c.jobCards[0]?.serviceDate).not.toBe(a.jobCards[0]?.serviceDate);
  });

  it("keeps null timestamps null and rebases set ones", async () => {
    const db = await rebaseSeed(seed, new Date(DAYS[3] ?? ""), "pw");
    expect(db.visits.some((v) => v.openedAt === null)).toBe(true);
    expect(db.visits.some((v) => v.openedAt !== null)).toBe(true);
    expect(db.visits.every((v) => v.token.length > 0)).toBe(true);
  });

  it("rebases a deleted response and a cancelled visit too", async () => {
    const edited: Seed = structuredClone(seed);
    const at = { dayOffset: -3, minute: 600 };
    const r0 = edited.responses[0];
    const v0 = edited.visits[0];
    if (r0 === undefined || v0 === undefined) throw new Error("seed is empty");
    r0.deletedAt = at;
    v0.cancelledAt = at;
    const now = new Date(DAYS[3] ?? "");
    const db = await rebaseSeed(edited, now, "pw");
    const expected = `${addDays(istDateOf(now), -3)}T04:30:00.000Z`;
    expect(db.responses[0]?.deletedAt).toBe(expected);
    expect(db.visits[0]?.cancelledAt).toBe(expected);
  });

  it("gives every user the hash of the demo password, never the password", async () => {
    const db = await rebaseSeed(seed, new Date(DAYS[3] ?? ""), "Demo@2026");
    const hash = await hashPassword("Demo@2026");
    expect(db.users.every((u) => u.passwordHash === hash)).toBe(true);
    expect(JSON.stringify(db)).not.toContain("Demo@2026");
  });
});
