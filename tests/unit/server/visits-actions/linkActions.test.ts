// @vitest-environment node
/* eslint-disable max-lines-per-function -- describe blocks group many short tests */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import type { LinkIssued } from "@/data/access/repos/visits";
import type { Result } from "@/data/access";
import { advisors, auditLog, jobCards, linkTokens, visits } from "@/server/db/schema";
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
const NOV15 = new Date("2026-11-15T06:30:00.000Z");
const NOV18 = new Date("2026-11-18T06:30:00.000Z");
const CHANGED = "This link can no longer be changed";
const ACTIONS = ["resendLink", "regenerateLink", "cancelLink"] as const;

beforeEach(async () => {
  env = await makeServerCtx();
  env.clock.at = NOV15;
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
async function card(branchId: string, no: string) {
  const [adv] = await env.db.insert(advisors).values({ branchId, name: "Suresh" }).returning();
  const [row] = await env.db
    .insert(jobCards)
    .values({
      branchId,
      jobCardNo: no,
      jobCardKey: keyOf(no),
      customerName: "Ramesh Kumar",
      phone: "+919840012345",
      regNo: "TN 09 BX 4521",
      regNoKey: "TN09BX4521",
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
const codeOf = (i: LinkIssued): string => i.url.split("/f/")[1] ?? "";
const audits = async (action: string) =>
  (await env.db.select().from(auditLog)).filter((a) => a.action === action);
async function liveCount(): Promise<number> {
  return (await env.db.select().from(linkTokens)).filter((t) => t.supersededAt === null).length;
}

/** Where a customer code leads: the token row, then its visit's state. */
async function resolve(code: string) {
  const [tok] = await env.db
    .select()
    .from(linkTokens)
    .where(eq(linkTokens.tokenHash, hashCode(code)));
  if (!tok) return undefined;
  const [visit] = await env.db.select().from(visits).where(eq(visits.id, tok.visitId));
  return { live: tok.supersededAt === null, visit: must(visit) };
}

/** Priya (Velachery) makes a link on 15 Nov; Arun is a colleague at the same branch. */
async function setup() {
  const velachery = await seedBranch(env.db, "Velachery");
  const priya = await staff(velachery, "Priya");
  const arun = await staff(velachery, "Arun");
  signIn(priya);
  const jc = await card(velachery, "JC-24-1042");
  const first = value(await repo().createVisitLink({ jobCardId: jc.id }));
  return { velachery, priya, arun, jc, first };
}

describe("resend (G-1, S-17)", () => {
  it("a 15 Nov link resent on 18 Nov: new code, WhatsApp URL carries it, still expires 22 Nov", async () => {
    const { first } = await setup();
    expect(first.visit.expiresAt).toBe("2026-11-22T06:30:00.000Z");
    env.clock.at = NOV18;
    const again = value(await repo().resendLink(first.visit.id));
    expect(codeOf(again)).toHaveLength(43);
    expect(codeOf(again)).not.toBe(codeOf(first));
    expect(again.visit.id).toBe(first.visit.id);
    expect(again.whatsappUrl).toContain(encodeURIComponent(again.url));
    expect(again.visit.expiresAt).toBe("2026-11-22T06:30:00.000Z");
    const [row] = await env.db.select().from(visits).where(eq(visits.id, first.visit.id));
    expect(must(row).expiresAt).toEqual(new Date("2026-11-22T06:30:00.000Z"));
  });

  it("the 15 Nov code now resolves to a superseded token of the same live visit (newer-link page)", async () => {
    const { first } = await setup();
    env.clock.at = NOV18;
    const again = value(await repo().resendLink(first.visit.id));
    const old = must(await resolve(codeOf(first)));
    expect(old.live).toBe(false);
    expect(old.visit.id).toBe(first.visit.id);
    expect(old.visit.cancelledAt).toBeNull();
    expect(old.visit.replacedBy).toBeNull();
    expect(must(await resolve(codeOf(again))).live).toBe(true);
  });

  it("writes audit link.resend with the actor and visit", async () => {
    const { first, priya } = await setup();
    env.clock.at = NOV18;
    value(await repo().resendLink(first.visit.id));
    const rows = await audits("link.resend");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actorId: priya.id,
      actorName: "Priya",
      entityType: "visit",
      entityId: first.visit.id,
    });
  });

  it("on an expired link is CONFLICT and writes nothing", async () => {
    const { first } = await setup();
    env.clock.at = new Date("2026-11-23T06:30:00.000Z");
    const tokens = await env.db.select().from(linkTokens);
    const r = await repo().resendLink(first.visit.id);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(!r.ok && r.error.message).toMatch(/Regenerate/);
    expect(await env.db.select().from(linkTokens)).toEqual(tokens);
    expect(await audits("link.resend")).toHaveLength(0);
  });

  it("still works at the last moment of the 7 days", async () => {
    const { first } = await setup();
    env.clock.at = new Date("2026-11-22T06:30:00.000Z");
    expect(value(await repo().resendLink(first.visit.id)).visit.id).toBe(first.visit.id);
  });
});

describe("a colleague acts on another's link (G-8)", () => {
  it("Arun resends Priya's link from All branch links: audit actor is Arun", async () => {
    const { arun, priya, first } = await setup();
    signIn(arun);
    const all = value(await repo().listVisits({ scope: "branch" }));
    expect(all.find((v) => v.id === first.visit.id)).toMatchObject({ mine: false });
    value(await repo().resendLink(first.visit.id));
    const [row] = await audits("link.resend");
    expect(row).toMatchObject({ actorId: arun.id, actorName: "Arun" });
    expect(must(row).actorId).not.toBe(priya.id);
  });

  it("Arun's regenerate and cancel are audited as Arun", async () => {
    const { arun, first } = await setup();
    signIn(arun);
    const fresh = value(await repo().regenerateLink(first.visit.id));
    value(await repo().cancelLink(fresh.visit.id));
    for (const action of ["link.regenerate", "link.cancel"]) {
      const [row] = await audits(action);
      expect(row).toMatchObject({ actorId: arun.id, actorName: "Arun" });
    }
  });
});

describe("regenerate (S-05)", () => {
  it("makes a new 7-day visit; the old code shows the newer-link state", async () => {
    const { first, priya } = await setup();
    env.clock.at = NOV18;
    const fresh = value(await repo().regenerateLink(first.visit.id));
    expect(fresh.visit.id).not.toBe(first.visit.id);
    expect(fresh.visit.expiresAt).toBe("2026-11-25T06:30:00.000Z");
    expect(fresh.visit.status).toBe("created");
    expect(fresh.whatsappUrl).toContain(encodeURIComponent(fresh.url));
    const old = must(await resolve(codeOf(first)));
    expect(old.live).toBe(false);
    expect(old.visit.replacedBy).toBe(fresh.visit.id);
    expect(must(await resolve(codeOf(fresh))).visit.id).toBe(fresh.visit.id);
    const [row] = await audits("link.regenerate");
    expect(row).toMatchObject({ actorId: priya.id, entityId: fresh.visit.id });
    expect(row?.newValue).toEqual({ replaced: first.visit.id });
  });

  it("works on an expired link", async () => {
    const { first } = await setup();
    env.clock.at = new Date("2026-11-30T06:30:00.000Z");
    const fresh = value(await repo().regenerateLink(first.visit.id));
    expect(fresh.visit.expiresAt).toBe("2026-12-07T06:30:00.000Z");
  });
});

describe("cancel (S-14)", () => {
  it("marks Cancelled; the code resolves to a cancelled visit (Link not valid); audit link.cancel", async () => {
    const { first, priya } = await setup();
    env.clock.at = NOV18;
    const out = value(await repo().cancelLink(first.visit.id));
    expect(out.status).toBe("cancelled");
    const old = must(await resolve(codeOf(first)));
    expect(old.live).toBe(false);
    expect(old.visit.cancelledAt).toEqual(NOV18);
    expect(await liveCount()).toBe(0);
    const rows = await audits("link.cancel");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actorId: priya.id, entityId: first.visit.id });
  });
});

describe("a link that can no longer be changed", () => {
  async function expectAllRefused(visitId: string): Promise<void> {
    const v = await env.db.select().from(visits);
    const t = await env.db.select().from(linkTokens);
    const a = (await env.db.select().from(auditLog)).length;
    for (const action of ACTIONS) {
      const r = await repo()[action](visitId);
      expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: CHANGED } });
    }
    expect(await env.db.select().from(visits)).toEqual(v);
    expect(await env.db.select().from(linkTokens)).toEqual(t);
    expect((await env.db.select().from(auditLog)).length).toBe(a);
  }

  it("completed", async () => {
    const { first } = await setup();
    await env.db.update(visits).set({ completedAt: env.clock.now() });
    await expectAllRefused(first.visit.id);
  });

  it("cancelled", async () => {
    const { first } = await setup();
    value(await repo().cancelLink(first.visit.id));
    await expectAllRefused(first.visit.id);
  });

  it("replaced", async () => {
    const { first } = await setup();
    value(await repo().regenerateLink(first.visit.id));
    await expectAllRefused(first.visit.id);
  });

  it("completed wins over expired for resend (no Regenerate hint)", async () => {
    const { first } = await setup();
    await env.db.update(visits).set({ completedAt: env.clock.now() });
    env.clock.at = new Date("2026-12-10T06:30:00.000Z");
    expect(await repo().resendLink(first.visit.id)).toMatchObject({ error: { message: CHANGED } });
  });
});

describe("another branch's visit id (US-29)", () => {
  it("is NOT_FOUND for resend, regenerate and cancel, and nothing changes", async () => {
    const { first } = await setup();
    const tambaram = await seedBranch(env.db, "Tambaram");
    signIn(await staff(tambaram, "Latha"));
    const before = await env.db.select().from(visits);
    for (const action of ACTIONS) {
      expect(await repo()[action](first.visit.id)).toMatchObject({
        ok: false,
        error: { code: "NOT_FOUND" },
      });
    }
    expect(await env.db.select().from(visits)).toEqual(before);
    expect(await liveCount()).toBe(1);
  });

  it("signed-out callers are refused and nothing changes", async () => {
    const { first } = await setup();
    env.ctx.session = null;
    for (const action of ACTIONS) {
      expect((await repo()[action](first.visit.id)).ok).toBe(false);
    }
    expect(await liveCount()).toBe(1);
  });
});
