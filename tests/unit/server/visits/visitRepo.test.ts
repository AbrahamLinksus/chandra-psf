// @vitest-environment node
/* eslint-disable max-lines-per-function -- describe blocks group many one-line tests */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import type { LinkIssued } from "@/data/access/repos/visits";
import type { Result } from "@/data/access";
import { advisors, jobCards, linkTokens, users, visits } from "@/server/db/schema";
import type { SessionUser } from "@/server/ctx";
import { makeServerCtx, must, seedBranch, seedUser } from "../../../support/serverCtx";

vi.mock("server-only", () => ({}));
vi.mock("@/server/env", () => ({
  getServerEnv: () => ({ APP_URL: "https://psf.chandra.test" }),
}));

const { ServerVisitRepo } = await import("@/server/repos/visits");
const { hashCode } = await import("@/server/tokens");

type Env = Awaited<ReturnType<typeof makeServerCtx>>;
let env: Env;

beforeEach(async () => {
  env = await makeServerCtx();
  env.clock.at = new Date("2026-11-24T06:30:00.000Z");
});
afterEach(async () => {
  await env.client.close();
});

const repo = () => new ServerVisitRepo(env.ctx);

function signIn(user: Partial<SessionUser> & Pick<SessionUser, "id" | "role">): void {
  env.ctx.session = {
    sessionId: "s",
    createdAt: env.clock.now(),
    lastActiveAt: env.clock.now(),
    user: { name: "Aide", email: "a@chandra.in", branchId: null, mustSetPassword: false, ...user },
  };
}
async function staff(branchId: string, name: string) {
  const id = await seedUser(env.db, { role: "support", branchId, name });
  return { id, branchId, role: "support" as const, name };
}
const keyOf = (s: string) => s.replace(/[^A-Z0-9]/gi, "").toUpperCase();
async function card(branchId: string, no: string, o: { phone?: string | null; reg?: string } = {}) {
  const reg = o.reg ?? "TN 09 BX 4521";
  const [adv] = await env.db
    .insert(advisors)
    .values({ branchId, name: `Adv ${no}` })
    .returning();
  const [row] = await env.db
    .insert(jobCards)
    .values({
      branchId,
      jobCardNo: no,
      jobCardKey: keyOf(no),
      customerName: "Ramesh Kumar",
      phone: o.phone === undefined ? "+919840012345" : o.phone,
      regNo: reg,
      regNoKey: keyOf(reg),
      model: "Activa",
      vehicleType: "scooter",
      advisorId: must(adv).id,
      serviceType: "Paid service",
      serviceDate: "2026-11-14",
      createdBy: await seedUser(env.db, { role: "support", branchId }),
    })
    .returning();
  return must(row);
}
function value<T>(r: Result<T>): T {
  if (!r.ok) throw new Error(`${r.error.code}: ${r.error.message}`);
  return r.value;
}
async function setup() {
  const velachery = await seedBranch(env.db, "Velachery");
  const kavitha = await staff(velachery, "Kavitha");
  signIn(kavitha);
  const jc = await card(velachery, "JC-24-1042");
  return { velachery, kavitha, jc };
}
const liveTokens = async () =>
  (await env.db.select().from(linkTokens)).filter((t) => t.supersededAt === null);

describe("createVisitLink (AC-2, D-11, S-01)", () => {
  it("issues a 43-char code under APP_URL, keeps only its SHA-256, expires in 7 days", async () => {
    const { jc } = await setup();
    const out = value(await repo().createVisitLink({ jobCardId: jc.id }));
    expect(out.url).toMatch(/^https:\/\/psf\.chandra\.test\/f\/[A-Za-z0-9_-]{43}$/);
    const code = out.url.split("/f/")[1] ?? "";
    const tokens = await env.db.select().from(linkTokens);
    expect(tokens).toHaveLength(1);
    expect(Buffer.from(must(tokens[0]).tokenHash).equals(hashCode(code))).toBe(true);
    expect(JSON.stringify(await env.db.select().from(visits))).not.toContain(code);
    expect(out.visit.status).toBe("created");
    expect(out.visit.mine).toBe(true);
    expect(out.visit.expiresAt).toBe("2026-12-01T06:30:00.000Z");
  });

  it("builds the SPEC wa.me URL for a mobile number", async () => {
    const { jc } = await setup();
    const out = value(await repo().createVisitLink({ jobCardId: jc.id }));
    const text =
      "Hi Ramesh Kumar, thank you for servicing your Activa (TN 09 BX 4521) at Chandra Honda. " +
      `Please share your feedback (2 mins): ${out.url}`;
    expect(out.whatsappUrl).toBe(`https://wa.me/919840012345?text=${encodeURIComponent(text)}`);
  });

  it("has no wa.me URL without a mobile number (S-03) but still gives the link to copy", async () => {
    const { velachery } = await setup();
    const nophone = await card(velachery, "JC-24-2002", { phone: null });
    const out = value(await repo().createVisitLink({ jobCardId: nophone.id }));
    expect(out.whatsappUrl).toBeNull();
    expect(out.url).toContain("/f/");
  });

  it("refuses a second link for a card with a live one", async () => {
    const { jc } = await setup();
    value(await repo().createVisitLink({ jobCardId: jc.id }));
    const again = await repo().createVisitLink({ jobCardId: jc.id });
    expect(again).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(await env.db.select().from(visits)).toHaveLength(1);
  });

  it("allows a new link after the old one was cancelled and chains replacedBy", async () => {
    const { jc } = await setup();
    const first = value(await repo().createVisitLink({ jobCardId: jc.id }));
    value(await repo().cancelLink(first.visit.id));
    const second = value(await repo().createVisitLink({ jobCardId: jc.id }));
    const [old] = await env.db.select().from(visits).where(eq(visits.id, first.visit.id));
    expect(must(old).replacedBy).toBe(second.visit.id);
  });

  it("says 'Feedback already received' for a completed card", async () => {
    const { jc } = await setup();
    const first = value(await repo().createVisitLink({ jobCardId: jc.id }));
    await env.db
      .update(visits)
      .set({ completedAt: env.clock.now() })
      .where(eq(visits.id, first.visit.id));
    const r = await repo().createVisitLink({ jobCardId: jc.id });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "ALREADY_COMPLETED", message: "Feedback already received" },
    });
  });

  it("rejects unknown ids, erased cards and cards of another branch", async () => {
    const { jc } = await setup();
    expect(await repo().createVisitLink({ jobCardId: "nope" })).toMatchObject({
      error: { code: "NOT_FOUND" },
    });
    const other = await seedBranch(env.db, "Tambaram");
    const foreign = await card(other, "JC-24-3001");
    expect(await repo().createVisitLink({ jobCardId: foreign.id })).toMatchObject({
      error: { code: "NOT_FOUND" },
    });
    await env.db.update(jobCards).set({ erasedAt: env.clock.now() }).where(eq(jobCards.id, jc.id));
    expect(await repo().createVisitLink({ jobCardId: jc.id })).toMatchObject({
      error: { code: "VALIDATION" },
    });
  });

  it("requires a signed-in staff member", async () => {
    const { jc } = await setup();
    env.ctx.session = null;
    expect(await repo().createVisitLink({ jobCardId: jc.id })).toMatchObject({ ok: false });
  });
});

describe("resend, regenerate, cancel", () => {
  async function issued(): Promise<LinkIssued> {
    const { jc } = await setup();
    return value(await repo().createVisitLink({ jobCardId: jc.id }));
  }

  it("resend gives a new code for the same visit and supersedes the old one", async () => {
    const first = await issued();
    const again = value(await repo().resendLink(first.visit.id));
    expect(again.visit.id).toBe(first.visit.id);
    expect(again.url).not.toBe(first.url);
    expect(await liveTokens()).toHaveLength(1);
  });

  it("resend of an expired link is refused with 'Regenerate it instead'", async () => {
    const first = await issued();
    env.clock.at = new Date("2026-12-02T06:30:00.000Z");
    const r = await repo().resendLink(first.visit.id);
    expect(r).toMatchObject({
      error: { code: "CONFLICT", message: "This link has expired. Regenerate it instead." },
    });
  });

  it("regenerate replaces the visit: one current link, old code dead", async () => {
    const first = await issued();
    env.clock.at = new Date("2026-12-02T06:30:00.000Z");
    const fresh = value(await repo().regenerateLink(first.visit.id));
    expect(fresh.visit.id).not.toBe(first.visit.id);
    expect(fresh.visit.status).toBe("created");
    const list = value(await repo().listVisits({ scope: "mine" }));
    expect(list.map((v) => v.id)).toEqual([fresh.visit.id]);
    expect(await liveTokens()).toHaveLength(1);
  });

  it("cancel marks the link cancelled; further changes are refused", async () => {
    const first = await issued();
    const c = value(await repo().cancelLink(first.visit.id));
    expect(c.status).toBe("cancelled");
    const r = repo();
    for (const call of [r.resendLink, r.regenerateLink, r.cancelLink]) {
      expect(await call(first.visit.id)).toMatchObject({
        error: { code: "CONFLICT", message: "This link can no longer be changed" },
      });
    }
  });

  it("resend and regenerate on an erased card are refused and write nothing", async () => {
    const first = await issued();
    await env.db.update(jobCards).set({ erasedAt: env.clock.now() });
    const tokensBefore = await env.db.select().from(linkTokens);
    const visitsBefore = await env.db.select().from(visits);
    const r = repo();
    for (const call of [r.resendLink, r.regenerateLink]) {
      expect(await call.call(r, first.visit.id)).toMatchObject({
        error: { code: "VALIDATION", message: "This customer's data has been erased." },
      });
    }
    expect(await env.db.select().from(linkTokens)).toEqual(tokensBefore);
    expect(await env.db.select().from(visits)).toEqual(visitsBefore);
  });

  it("a colleague at the same branch can resend and regenerate (G-8, D-35)", async () => {
    const first = await issued();
    const [row] = await env.db.select().from(jobCards);
    signIn(await staff(must(row).branchId, "Meena"));
    const again = value(await repo().resendLink(first.visit.id));
    expect(again.visit.id).toBe(first.visit.id);
    expect(again.visit.mine).toBe(false);
    const fresh = value(await repo().regenerateLink(first.visit.id));
    expect(fresh.visit.mine).toBe(true);
  });

  it("unknown or non-UUID visit ids are NOT_FOUND", async () => {
    await issued();
    expect(await repo().resendLink("x")).toMatchObject({ error: { code: "NOT_FOUND" } });
    expect(await repo().cancelLink(crypto.randomUUID())).toMatchObject({
      error: { code: "NOT_FOUND" },
    });
  });
});

describe("listVisits (My links / All branch links; G-8, S-19)", () => {
  it("mine shows only own links; branch shows all with created-by and no code", async () => {
    const { velachery, jc } = await setup();
    value(await repo().createVisitLink({ jobCardId: jc.id }));
    env.clock.at = new Date("2026-11-24T07:30:00.000Z");
    signIn(await staff(velachery, "Meena"));
    const jc2 = await card(velachery, "JC-24-2002", { reg: "TN 10 AB 1111" });
    value(await repo().createVisitLink({ jobCardId: jc2.id }));
    const mine = value(await repo().listVisits({ scope: "mine" }));
    expect(mine.map((v) => v.jobCardNo)).toEqual(["JC-24-2002"]);
    const all = value(await repo().listVisits({ scope: "branch" }));
    expect(all.map((v) => [v.jobCardNo, v.createdByName, v.mine])).toEqual([
      ["JC-24-2002", "Meena", true],
      ["JC-24-1042", "Kavitha", false],
    ]);
    const keys = Object.keys(all[0] ?? {});
    expect(keys).not.toContain("url");
    expect(keys).not.toContain("answers");
  });

  it("searches by job card number or reg. no, ignoring spacing and case", async () => {
    const { velachery, jc } = await setup();
    value(await repo().createVisitLink({ jobCardId: jc.id }));
    const jc2 = await card(velachery, "JC-24-2002", { reg: "TN 10 AB 1111" });
    value(await repo().createVisitLink({ jobCardId: jc2.id }));
    const find = async (s: string) =>
      value(await repo().listVisits({ scope: "mine", search: s })).map((v) => v.jobCardNo);
    expect(await find("jc 24 1042")).toEqual(["JC-24-1042"]);
    expect(await find("tn10ab")).toEqual(["JC-24-2002"]);
    expect(await find("zzz")).toEqual([]);
    expect(await find("  ")).toHaveLength(2);
  });

  it("a user moved to Tambaram sees only Tambaram's links", async () => {
    const { kavitha, jc } = await setup();
    value(await repo().createVisitLink({ jobCardId: jc.id }));
    const tambaram = await seedBranch(env.db, "Tambaram");
    signIn(await staff(tambaram, "Latha"));
    const jt = await card(tambaram, "JC-24-3001");
    value(await repo().createVisitLink({ jobCardId: jt.id }));
    await env.db.update(users).set({ branchId: tambaram }).where(eq(users.id, kavitha.id));
    signIn({ ...kavitha, branchId: tambaram });
    const all = value(await repo().listVisits({ scope: "branch" }));
    expect(all.map((v) => v.jobCardNo)).toEqual(["JC-24-3001"]);
  });

  it("cannot resend another branch's link", async () => {
    const { jc } = await setup();
    const first = value(await repo().createVisitLink({ jobCardId: jc.id }));
    const tambaram = await seedBranch(env.db, "Tambaram");
    signIn(await staff(tambaram, "Latha"));
    expect(await repo().resendLink(first.visit.id)).toMatchObject({ error: { code: "NOT_FOUND" } });
  });

  it("reports expired status after 7 days and completed after feedback", async () => {
    const { jc } = await setup();
    const first = value(await repo().createVisitLink({ jobCardId: jc.id }));
    env.clock.at = new Date("2026-12-02T06:30:00.000Z");
    expect(must(value(await repo().listVisits({ scope: "mine" }))[0]).status).toBe("expired");
    await env.db
      .update(visits)
      .set({ completedAt: env.clock.now() })
      .where(eq(visits.id, first.visit.id));
    expect(must(value(await repo().listVisits({ scope: "mine" }))[0]).status).toBe("completed");
  });
});
