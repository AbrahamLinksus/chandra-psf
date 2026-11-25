// @vitest-environment node
/* eslint-disable max-lines-per-function -- describe blocks group many one-line tests */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { QUESTIONNAIRE_V2 } from "@/domain/questionnaire";
import {
  advisors,
  auditLog,
  jobCards,
  questionnaires,
  responses,
  visits,
} from "@/server/db/schema";
import type { SessionUser } from "@/server/ctx";
import { makeServerCtx, must, seedBranch, seedUser } from "../../../support/serverCtx";

vi.mock("server-only", () => ({}));

const { ServerCustomerRepo } = await import("@/server/repos/customers");

type Env = Awaited<ReturnType<typeof makeServerCtx>>;
let env: Env;
beforeEach(async () => {
  env = await makeServerCtx();
  env.clock.at = new Date("2026-11-25T06:30:00.000Z");
});
afterEach(async () => {
  await env.client.close();
});

const repo = () => new ServerCustomerRepo(env.ctx);
const BOM = "﻿";

function signIn(user: Pick<SessionUser, "id" | "role"> & Partial<SessionUser>): void {
  env.ctx.session = {
    sessionId: "s",
    createdAt: env.clock.now(),
    lastActiveAt: env.clock.now(),
    user: { name: "Meena", email: "m@chandra.in", branchId: null, mustSetPassword: false, ...user },
  };
}
async function asMain(): Promise<void> {
  signIn({ id: await seedUser(env.db, { role: "main_admin" }), role: "main_admin" });
}

const keyOf = (s: string) => s.replace(/[^A-Z0-9]/gi, "").toUpperCase();
async function card(
  branchId: string,
  o: { no: string; name: string; date: string; phone?: string; reg: string },
) {
  const [adv] = await env.db
    .insert(advisors)
    .values({ branchId, name: `Adv ${o.no}` })
    .returning();
  const phone = o.phone ?? "+919840012345";
  const [row] = await env.db
    .insert(jobCards)
    .values({
      branchId,
      jobCardNo: o.no,
      jobCardKey: keyOf(o.no),
      customerName: o.name,
      phone,
      phoneKey: phone.slice(-10),
      regNo: o.reg,
      regNoKey: keyOf(o.reg),
      model: "Activa 6G",
      vehicleType: "scooter",
      advisorId: must(adv).id,
      serviceType: "Paid service",
      serviceDate: o.date,
      createdBy: await seedUser(env.db, { role: "support", branchId }),
    })
    .returning();
  return must(row);
}

async function answered(cardRow: Awaited<ReturnType<typeof card>>, answers: object) {
  await env.db
    .insert(questionnaires)
    .values({ version: QUESTIONNAIRE_V2.version, definition: QUESTIONNAIRE_V2 })
    .onConflictDoNothing();
  const [v] = await env.db
    .insert(visits)
    .values({
      jobCardId: cardRow.id,
      branchId: cardRow.branchId,
      createdBy: cardRow.createdBy,
      createdAt: new Date("2026-11-14T05:00:00Z"),
      expiresAt: new Date("2026-11-21T05:00:00Z"),
      completedAt: new Date("2026-11-14T06:00:00Z"),
    })
    .returning();
  await env.db.insert(responses).values({
    visitId: must(v).id,
    questionsVersion: 2,
    answers,
    submissionId: crypto.randomUUID(),
  });
}

async function twoBranches() {
  const vel = await seedBranch(env.db, "Velachery");
  const tam = await seedBranch(env.db, "Tambaram");
  const ramesh = await card(vel, {
    no: "JC-1",
    name: "Ramesh Kumar",
    date: "2026-11-14",
    reg: "TN 09 BX 4521",
  });
  const lakshmi = await card(tam, {
    no: "JC-2",
    name: "Lakshmi Kumar",
    date: "2026-12-02",
    reg: "TN 22 AB 1111",
  });
  await card(tam, {
    no: "JC-3",
    name: "Someone Else",
    date: "2026-11-01",
    phone: "+919999900000",
    reg: "TN 22 CD 2222",
  });
  return { vel, tam, ramesh, lakshmi };
}

describe("searchCustomers (US-30, S-21)", () => {
  it("finds the same phone across branches, newest first, without other numbers", async () => {
    const { ramesh, lakshmi } = await twoBranches();
    await asMain();
    const r = await repo().searchCustomers({ phone: "98400 12345" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.map((x) => x.jobCardId)).toEqual([lakshmi.id, ramesh.id]);
    expect(r.value.map((x) => [x.customerName, x.branchName, x.serviceDate])).toEqual([
      ["Lakshmi Kumar", "Tambaram", "2026-12-02"],
      ["Ramesh Kumar", "Velachery", "2026-11-14"],
    ]);
  });

  it("finds by registration number ignoring spaces and case", async () => {
    const { ramesh } = await twoBranches();
    await asMain();
    const r = await repo().searchCustomers({ regNo: "tn09 bx4521" });
    expect(r.ok && r.value.map((x) => x.jobCardId)).toEqual([ramesh.id]);
  });

  it("no match is an empty list; an erased card is not found", async () => {
    await twoBranches();
    await asMain();
    const none = await repo().searchCustomers({ phone: "90000 00000" });
    expect(none.ok && none.value).toEqual([]);
    await env.db.update(jobCards).set({ erasedAt: new Date() });
    const erased = await repo().searchCustomers({ phone: "9840012345" });
    expect(erased.ok && erased.value).toEqual([]);
  });

  it("rejects a short phone and an empty query", async () => {
    await asMain();
    const short = await repo().searchCustomers({ phone: "98400" });
    expect(!short.ok && short.error.code).toBe("VALIDATION");
    const empty = await repo().searchCustomers({});
    expect(!empty.ok && empty.error.code).toBe("VALIDATION");
  });

  it("a branch admin, a support user and a signed-out caller are refused (G-4, G-W2)", async () => {
    const { vel } = await twoBranches();
    const q = { phone: "98400 12345" };
    const out = await repo().searchCustomers(q);
    expect(!out.ok && out.error.code).toBe("UNAUTHENTICATED");
    signIn({
      id: await seedUser(env.db, { role: "branch_admin", branchId: vel }),
      role: "branch_admin",
      branchId: vel,
    });
    const ba = await repo().searchCustomers(q);
    expect(!ba.ok && ba.error.code).toBe("FORBIDDEN");
    const baEx = await repo().exportCustomers(["x"]);
    expect(!baEx.ok && baEx.error.code).toBe("FORBIDDEN");
    signIn({
      id: await seedUser(env.db, { role: "support", branchId: vel }),
      role: "support",
      branchId: vel,
    });
    const su = await repo().searchCustomers(q);
    expect(!su.ok && su.error.code).toBe("FORBIDDEN");
    const suEx = await repo().exportCustomers(["x"]);
    expect(!suEx.ok && suEx.error.code).toBe("FORBIDDEN");
    expect(await env.db.select().from(auditLog)).toHaveLength(0);
  });
});

describe("exportCustomers (US-30, F-10)", () => {
  it("exports only the ticked job card with a BOM and audits the count with no personal values", async () => {
    const { ramesh } = await twoBranches();
    await answered(ramesh, { Q1: 5, Q4: "Yes" });
    await asMain();
    const r = await repo().exportCustomers([ramesh.id]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.filename).toBe("customers-2026-11-25.csv");
    const csv = r.value.csv;
    expect(csv.startsWith(BOM)).toBe(true);
    const lines = csv.slice(1).trimEnd().split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("Ramesh Kumar");
    expect(lines[1]).toContain("Velachery");
    expect(csv).not.toContain("Lakshmi");
    expect(csv).not.toContain("Tambaram");
    expect(csv).not.toContain("Someone Else");
    for (const code of ["Q1", "Q4", "Q10a"]) expect(lines[0]).toContain(code);

    const audit = await env.db.select().from(auditLog);
    expect(audit).toHaveLength(1);
    const a = must(audit[0]);
    expect(a.action).toBe("customer.export");
    expect(a.newValue).toEqual({ count: 1 });
    expect(a.oldValue).toBeNull();
    const dump = JSON.stringify(a);
    for (const secret of ["Ramesh", "98400", "9840012345", "TN 09", "TN09", ramesh.id, "JC-1"]) {
      expect(dump).not.toContain(secret);
    }
  });

  it("joins option answers and quotes commas and quotes", async () => {
    const { ramesh } = await twoBranches();
    await answered(ramesh, { Q1: 2, Q1a: { options: ["Delay", "Rude"], text: 'bad, "very"' } });
    await asMain();
    const r = await repo().exportCustomers([ramesh.id]);
    expect(r.ok && r.value.csv).toContain('"Delay; Rude; bad, ""very"""');
  });

  it("a name starting with = is prefixed with ' so Excel will not run it", async () => {
    const vel = await seedBranch(env.db, "Velachery");
    const evil = await card(vel, {
      no: "JC-9",
      name: '=HYPERLINK("http://x")',
      date: "2026-11-14",
      reg: "TN 01 AA 0001",
    });
    await asMain();
    const r = await repo().exportCustomers([evil.id]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.csv).toContain(`"'=HYPERLINK(""http://x"")"`);
  });

  it("empty ticks and unknown ids fail without an audit row", async () => {
    await twoBranches();
    await asMain();
    const none = await repo().exportCustomers([]);
    expect(!none.ok && none.error.code).toBe("VALIDATION");
    const missing = await repo().exportCustomers([crypto.randomUUID()]);
    expect(!missing.ok && missing.error.code).toBe("NOT_FOUND");
    expect(await env.db.select().from(auditLog)).toHaveLength(0);
  });

  it("an erased card is skipped; only erased ticked gives NOT_FOUND with no audit row", async () => {
    const { ramesh, lakshmi } = await twoBranches();
    await asMain();
    await env.db.update(jobCards).set({ erasedAt: new Date() }).where(eq(jobCards.id, ramesh.id));
    const mixed = await repo().exportCustomers([ramesh.id, lakshmi.id]);
    expect(mixed.ok).toBe(true);
    const a = must((await env.db.select().from(auditLog))[0]);
    expect(a.newValue).toEqual({ count: 1 });
    const only = await repo().exportCustomers([ramesh.id]);
    expect(!only.ok && only.error.code).toBe("NOT_FOUND");
    expect(await env.db.select().from(auditLog)).toHaveLength(1);
  });

  it("counts distinct cards when ids repeat", async () => {
    const { ramesh, lakshmi } = await twoBranches();
    await asMain();
    const r = await repo().exportCustomers([ramesh.id, ramesh.id, lakshmi.id]);
    expect(r.ok).toBe(true);
    const a = must((await env.db.select().from(auditLog))[0]);
    expect(a.newValue).toEqual({ count: 2 });
  });
});
