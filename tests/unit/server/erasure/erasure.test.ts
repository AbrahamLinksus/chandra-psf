// @vitest-environment node
/* eslint-disable max-lines, max-lines-per-function -- describe blocks group many one-line tests */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { QUESTIONNAIRE_V2 } from "@/domain/questionnaire";
import {
  advisors,
  alerts,
  auditLog,
  erasureJournal,
  jobCards,
  questionnaires,
  responses,
  users,
  visits,
} from "@/server/db/schema";
import { hashPassword } from "@/server/auth/password";
import { writeAudit } from "@/server/audit";
import type { SessionUser } from "@/server/ctx";
import { makeServerCtx, must, seedBranch, seedUser } from "../../../support/serverCtx";
import { reapplyErasures } from "../../../../scripts/admin";

vi.mock("server-only", () => ({}));

const { ServerCustomerRepo } = await import("@/server/repos/customers");

type Env = Awaited<ReturnType<typeof makeServerCtx>>;
const PW = "Correct-Horse-9";
const Q2a = "The advisor was rude, call me on 9840012345";
let env: Env;
let pwHash = "";
let stdout: string[] = [];

beforeEach(async () => {
  env = await makeServerCtx();
  if (pwHash === "") pwHash = await hashPassword(PW);
  stdout = [];
  vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => {
    stdout.push(String(chunk));
    return true;
  });
});
afterEach(async () => {
  vi.restoreAllMocks();
  await env.client.close();
});

const repo = () => new ServerCustomerRepo(env.ctx);
const keyOf = (s: string) => s.replace(/[^A-Z0-9]/gi, "").toUpperCase();

async function asMain(): Promise<void> {
  const id = await seedUser(env.db, { role: "main_admin" });
  await env.db.update(users).set({ passwordHash: pwHash }).where(eq(users.id, id));
  const user: SessionUser = {
    id,
    role: "main_admin",
    name: "Meena",
    email: "m@chandra.in",
    branchId: null,
    mustSetPassword: false,
  };
  env.ctx.session = {
    sessionId: "s",
    createdAt: env.clock.now(),
    lastActiveAt: env.clock.now(),
    user,
  };
}

interface Seeded {
  card: string;
  visit: string;
  response: string;
  alert: string;
}

/** One job card with a visit, a soft-deleted response holding Q2a, an alert note and audit rows. */
async function customer(
  db: Env["db"],
  branchId: string,
  o: { id?: string; no: string; name: string; reg: string; phone: string },
): Promise<Seeded> {
  const [adv] = await db
    .insert(advisors)
    .values({ branchId, name: `Adv ${o.no}` })
    .returning();
  const by = await seedUser(db, { role: "support", branchId });
  const [c] = await db
    .insert(jobCards)
    .values({
      ...(o.id ? { id: o.id } : {}),
      branchId,
      jobCardNo: o.no,
      jobCardKey: keyOf(o.no),
      customerName: o.name,
      phone: o.phone,
      phoneKey: o.phone.slice(-10),
      regNo: o.reg,
      regNoKey: keyOf(o.reg),
      model: "Activa",
      vehicleType: "scooter",
      advisorId: must(adv).id,
      serviceType: "Paid service",
      serviceDate: "2026-11-14",
      createdBy: by,
    })
    .returning();
  await db
    .insert(questionnaires)
    .values({ version: QUESTIONNAIRE_V2.version, definition: QUESTIONNAIRE_V2 })
    .onConflictDoNothing();
  const [v] = await db
    .insert(visits)
    .values({
      jobCardId: must(c).id,
      branchId,
      createdBy: by,
      createdAt: new Date("2026-11-14T05:00:00Z"),
      expiresAt: new Date("2026-11-21T05:00:00Z"),
      completedAt: new Date("2026-11-14T06:00:00Z"),
    })
    .returning();
  const [r] = await db
    .insert(responses)
    .values({
      visitId: must(v).id,
      questionsVersion: 2,
      answers: {
        Q1: 2,
        Q1a: { options: ["Delay"], text: "slow desk" },
        Q2a,
        Q10: "Yes",
        Q10a: "Evening (3 PM–6 PM)",
      },
      submissionId: crypto.randomUUID(),
      deletedAt: new Date("2026-11-15T05:00:00Z"),
    })
    .returning();
  const [a] = await db
    .insert(alerts)
    .values({
      responseId: must(r).id,
      branchId,
      reasons: [],
      notes: [{ at: "2026-11-15T05:00:00Z", by: "Meena", text: `called ${o.name}` }],
    })
    .returning();
  const seeded = { card: must(c).id, visit: must(v).id, response: must(r).id, alert: must(a).id };
  const stamp = { session: null, clock: env.clock };
  await writeAudit(stamp, db, {
    action: "alert.note",
    entityType: "alert",
    entityId: seeded.alert,
    note: `called ${o.name}`,
    branchId,
  });
  await writeAudit(stamp, db, {
    action: "response.edit",
    entityType: "response",
    entityId: seeded.response,
    oldValue: { Q2a: `old ${o.name}` },
    newValue: { Q2a },
    branchId,
  });
  await writeAudit(stamp, db, {
    action: "response.create",
    entityType: "response",
    entityId: seeded.response,
    newValue: { Q2a },
    branchId,
  });
  return seeded;
}

async function two() {
  const branch = await seedBranch(env.db, "Velachery");
  const ramesh = await customer(env.db, branch, {
    no: "JC-1",
    name: "Ramesh Kumar",
    reg: "TN 09 BX 4521",
    phone: "+919840012345",
  });
  const lakshmi = await customer(env.db, branch, {
    no: "JC-2",
    name: "Lakshmi Kumar",
    reg: "TN 22 AB 1111",
    phone: "+919840012345",
  });
  return { branch, ramesh, lakshmi };
}

const cardOf = async (id: string) =>
  must((await env.db.select().from(jobCards).where(eq(jobCards.id, id)))[0]);
const answersOf = async (id: string) =>
  must((await env.db.select().from(responses).where(eq(responses.id, id)))[0]).answers;
const auditOf = (id: string) => env.db.select().from(auditLog).where(eq(auditLog.entityId, id));

describe("eraseCustomers (US-30, S-21)", () => {
  it("erases only the ticked card: personal data, Q2a in a deleted response, alert notes and audit values", async () => {
    const { ramesh, lakshmi } = await two();
    await asMain();
    const r = await repo().eraseCustomers([ramesh.card], { password: PW });
    expect(r).toEqual({ ok: true, value: { erased: 1 } });

    const gone = await cardOf(ramesh.card);
    expect([gone.customerName, gone.phone, gone.phoneKey, gone.regNo, gone.regNoKey]).toEqual([
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(gone.erasedAt).not.toBeNull();
    expect(await answersOf(ramesh.response)).toEqual({
      Q1: 2,
      Q1a: { options: ["Delay"] },
      Q10: "Yes",
      Q10a: "Evening (3 PM–6 PM)",
    });
    const [alert] = await env.db.select().from(alerts).where(eq(alerts.id, ramesh.alert));
    expect((alert?.notes as { text: string }[])[0]?.text).toBe("[erased]");

    const rows = await auditOf(ramesh.response);
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.newValue).toBe("[erased]");
      expect(JSON.stringify(row)).not.toMatch(/rude|Ramesh/);
    }
    expect(rows.find((x) => x.action === "response.create")?.oldValue).toBeNull();
    expect(rows.find((x) => x.action === "response.edit")?.oldValue).toBe("[erased]");

    // Lakshmi: card, response and audit rows untouched
    const kept = await cardOf(lakshmi.card);
    expect([kept.customerName, kept.phone, kept.regNo, kept.erasedAt]).toEqual([
      "Lakshmi Kumar",
      "+919840012345",
      "TN 22 AB 1111",
      null,
    ]);
    expect(await answersOf(lakshmi.response)).toMatchObject({ Q2a });
    expect((await auditOf(lakshmi.response)).map((x) => x.newValue)).toEqual([{ Q2a }, { Q2a }]);

    // alert audit notes: Ramesh's redacted, Lakshmi's kept
    expect((await auditOf(ramesh.alert)).map((x) => x.note)).toEqual(["[erased]"]);
    expect((await auditOf(lakshmi.alert)).map((x) => x.note)).toEqual(["called Lakshmi Kumar"]);
  });

  it("writes the customer.erase audit row with only the count", async () => {
    const { ramesh, lakshmi } = await two();
    await asMain();
    await repo().eraseCustomers([ramesh.card, lakshmi.card, ramesh.card], { password: PW });
    const rows = await env.db.select().from(auditLog).where(eq(auditLog.action, "customer.erase"));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.newValue).toEqual({ count: 2 });
    expect(JSON.stringify(rows[0])).not.toMatch(/Ramesh|Lakshmi|9840012345|TN 09/);
  });

  it("a wrong password erases nothing and writes no journal, audit or log row", async () => {
    const { ramesh } = await two();
    await asMain();
    const r = await repo().eraseCustomers([ramesh.card], { password: "Wrong-Pass-1" });
    expect(!r.ok && r.error.code).toBe("BAD_PASSWORD");
    expect((await cardOf(ramesh.card)).customerName).toBe("Ramesh Kumar");
    expect(await answersOf(ramesh.response)).toMatchObject({ Q2a });
    expect(await env.db.select().from(erasureJournal)).toHaveLength(0);
    const audit = await env.db.select().from(auditLog).where(eq(auditLog.action, "customer.erase"));
    expect(audit).toHaveLength(0);
    expect(stdout.join("")).not.toContain('"event":"erasure"');
  });

  it("refuses a signed-out caller, empty ticks, unknown ids and an already erased card", async () => {
    const { ramesh } = await two();
    const out = await repo().eraseCustomers([ramesh.card], { password: PW });
    expect(!out.ok && out.error.code).toBe("UNAUTHENTICATED");
    await asMain();
    const none = await repo().eraseCustomers([], { password: PW });
    expect(!none.ok && none.error.code).toBe("VALIDATION");
    const unknown = await repo().eraseCustomers([crypto.randomUUID()], { password: PW });
    expect(!unknown.ok && unknown.error.code).toBe("NOT_FOUND");
    expect((await repo().eraseCustomers([ramesh.card], { password: PW })).ok).toBe(true);
    const again = await repo().eraseCustomers([ramesh.card], { password: PW });
    expect(!again.ok && again.error.code).toBe("NOT_FOUND");
    expect(await env.db.select().from(erasureJournal)).toHaveLength(1);
  });

  it("a branch admin is refused and nothing is erased", async () => {
    const { branch, ramesh } = await two();
    const id = await seedUser(env.db, { role: "branch_admin", branchId: branch });
    env.ctx.session = {
      sessionId: "s",
      createdAt: env.clock.now(),
      lastActiveAt: env.clock.now(),
      user: {
        id,
        role: "branch_admin",
        name: "B",
        email: "b@c.in",
        branchId: branch,
        mustSetPassword: false,
      },
    };
    const r = await repo().eraseCustomers([ramesh.card], { password: PW });
    expect(!r.ok && r.error.code).toBe("FORBIDDEN");
    expect((await cardOf(ramesh.card)).customerName).toBe("Ramesh Kumar");
  });
});

describe("erasure journal and log (G-5)", () => {
  it("journals each erased card as a request and logs one event with job card ids only", async () => {
    const { ramesh } = await two();
    await asMain();
    await repo().eraseCustomers([ramesh.card], { password: PW });
    const journal = await env.db.select().from(erasureJournal);
    expect(journal.map((j) => [j.jobCardId, j.source])).toEqual([[ramesh.card, "request"]]);

    const events = stdout
      .join("")
      .split("\n")
      .filter((l) => l.includes('"event":"erasure"'));
    expect(events).toHaveLength(1);
    const text = events[0] ?? "";
    expect(JSON.parse(text)).toMatchObject({
      event: "erasure",
      source: "request",
      count: 1,
      jc1: ramesh.card,
    });
    for (const secret of ["Ramesh", "9840012345", "TN 09", "TN09", "rude", "JC-1"]) {
      expect(text).not.toContain(secret);
    }
  });
});

describe("reapply-erasures (S-24, LLD section 26)", () => {
  async function snapshot(db: Env["db"]): Promise<string> {
    return JSON.stringify([
      await db.select().from(jobCards),
      await db.select().from(responses),
      await db.select().from(alerts),
      await db.select().from(auditLog),
      await db.select().from(erasureJournal),
    ]);
  }

  it("re-erases journal ids on a restored copy, and a second run changes nothing", async () => {
    const { ramesh, lakshmi } = await two();
    await asMain();
    await repo().eraseCustomers([ramesh.card], { password: PW });

    // The "restored" database is a second real PGlite from before the erasure: same ids, data back.
    const restored = await makeServerCtx();
    try {
      const branch = await seedBranch(restored.db, "Velachery");
      const old = { reg: "TN 09 BX 4521", phone: "+919840012345" };
      await customer(restored.db, branch, {
        id: ramesh.card,
        no: "JC-1",
        name: "Ramesh Kumar",
        ...old,
      });
      await customer(restored.db, branch, {
        id: lakshmi.card,
        no: "JC-2",
        name: "Lakshmi Kumar",
        reg: "TN 22 AB 1111",
        phone: old.phone,
      });
      const deps = { db: restored.db };

      expect(await reapplyErasures(deps, env.db)).toEqual({ erased: 1 });
      const cards = Object.fromEntries(
        (await restored.db.select().from(jobCards)).map((c) => [c.jobCardNo, c]),
      );
      expect(cards["JC-1"]?.customerName).toBeNull();
      expect(cards["JC-1"]?.erasedAt).not.toBeNull();
      expect(cards["JC-2"]?.customerName).toBe("Lakshmi Kumar");
      const withQ2a = (await restored.db.select().from(responses)).filter((x) =>
        JSON.stringify(x.answers).includes("rude"),
      );
      expect(withQ2a).toHaveLength(1);
      expect((await restored.db.select().from(erasureJournal)).map((j) => j.jobCardId)).toEqual([
        ramesh.card,
      ]);

      const before = await snapshot(restored.db);
      expect(await reapplyErasures(deps, env.db)).toEqual({ erased: 0 });
      expect(await snapshot(restored.db)).toBe(before);
    } finally {
      await restored.client.close();
    }
  });

  it("an empty source journal erases nothing", async () => {
    await two();
    const other = await makeServerCtx();
    try {
      expect(await reapplyErasures({ db: env.db }, other.db)).toEqual({ erased: 0 });
      expect((await env.db.select().from(jobCards)).every((c) => c.erasedAt === null)).toBe(true);
    } finally {
      await other.client.close();
    }
  });
});
