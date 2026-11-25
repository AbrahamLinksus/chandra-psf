// @vitest-environment node
/* eslint-disable max-lines, max-lines-per-function -- the matrix is one table; the describe groups its generated tests */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import type { RequestCtx, SessionUser } from "@/server/ctx";
import {
  advisors,
  alerts,
  auditLog,
  jobCards,
  responses,
  users as usersTable,
} from "@/server/db/schema";
import { must, makeServerCtx, seedBranch, seedUser } from "../../../support/serverCtx";
import { seedLink } from "../feedback/harness";

vi.mock("server-only", () => ({}));

const { createServerDataAccess } = await import("@/server/createServerDataAccess");
const { rpcTables } = await import("@/server/rpc");
const { scopeOf } = await import("@/server/scope");

/**
 * LLD-phase2 §19 scope matrix (US-29, AC-6, G-W2). The data lives in branch A ("Alpha").
 * supportA is in scope of it; supportB and adminB belong to branch B and must never see or change it.
 */
type Actor = "supportA" | "supportB" | "adminB" | "main";
const ACTORS: Actor[] = ["supportB", "adminB", "supportA", "main"]; // out-of-scope actors first
const ORDER: Actor[] = ["supportA", "supportB", "adminB", "main"]; // column order in `who`

/**
 * denied: NOT_FOUND or FORBIDDEN, never data · scoped: ok but nothing of branch A
 * allowed: not a scope denial · blocked: any error (a write that must not go through)
 * stub: UNAVAILABLE (method not built yet) · any: public method, outcome not scope-related
 */
type Expect = "denied" | "scoped" | "allowed" | "blocked" | "stub" | "any";

type Fx = {
  a: string;
  cardNo: string;
  cardId: string;
  visitId: string;
  responseId: string;
  deletedResponseId: string;
  alertId: string;
  advisorId: string;
  userId: string;
};

interface Call {
  label?: string;
  args: (f: Fx) => unknown[];
  who: [Expect, Expect, Expect, Expect] | Expect; // supportA, supportB, adminB, main
}

const FILTERS = { from: "2026-01-01", to: "2026-12-31" };
const STEP = { password: "not-the-password" };
const TEMP_PW = ["Temp", "pass", "12345"].join("-");
const D: Expect = "denied";
const S: Expect = "scoped";
const A: Expect = "allowed";
const ADMIN_ONLY_SCOPED: Call["who"] = [D, D, S, A];
const ADMIN_ONLY_DENIED: Call["who"] = [D, D, D, A];
const BRANCH_ROW: Call["who"] = [A, D, D, A];
const MAIN_ONLY: Call["who"] = [D, D, D, A];

const rows: Record<string, Call[]> = {
  // auth: public or own-session methods; they never read another branch's data
  "auth.signIn": [{ args: () => ["nobody@example.in", "wrong"], who: "any" }],
  "auth.setOwnPassword": [{ args: () => ["x"], who: "any" }],
  "auth.changePassword": [{ args: () => ["wrong", "x"], who: "any" }],
  "auth.signOut": [{ args: () => [], who: "any" }],
  "auth.currentUser": [{ args: () => [], who: "any" }],
  // feedback: the link code is the capability, not the session
  "feedback.getVisitByToken": [{ args: () => ["not-a-code"], who: "any" }],
  "feedback.markOpened": [{ args: () => ["not-a-code"], who: "any" }],
  "feedback.submitResponse": [{ args: () => ["not-a-code", {}], who: "any" }],
  // job cards, visits, links: own branch; main admin everywhere
  "jobCards.getJobCard": [{ args: (f) => [f.cardNo], who: [A, D, D, A] }],
  "jobCards.createJobCard": [
    {
      label: "into branch A with A's advisor",
      args: (f) => [
        {
          jobCardNo: "JC-NEW-1",
          customerName: "New Customer",
          phone: "+919840099999",
          regNo: "TN 09 ZZ 0001",
          model: "Activa",
          serviceType: "Paid service",
          serviceDate: "2026-11-20",
          advisorId: f.advisorId,
          requestId: crypto.randomUUID(),
        },
      ],
      who: [A, "blocked", "blocked", D],
    },
  ],
  "jobCards.updateJobCard": [{ args: (f) => [f.cardId, { model: "Jupiter" }], who: [A, D, D, A] }],
  "jobCards.listFreshJobCards": [{ args: () => [], who: "stub" }],
  "visits.listVisits": [
    { label: "branch", args: () => [{ scope: "branch" }], who: [A, S, S, A] },
    { label: "mine", args: () => [{ scope: "mine" }], who: [A, S, S, A] },
  ],
  "visits.createVisitLink": [{ args: (f) => [{ jobCardId: f.cardId }], who: BRANCH_ROW }],
  "visits.resendLink": [{ args: (f) => [f.visitId], who: BRANCH_ROW }],
  "visits.regenerateLink": [{ args: (f) => [f.visitId], who: BRANCH_ROW }],
  "visits.cancelLink": [{ args: (f) => [f.visitId], who: BRANCH_ROW }],
  // analytics, alerts, responses, audit: admins only, own branch
  "analytics.getAnalytics": [
    { args: () => [FILTERS], who: ADMIN_ONLY_SCOPED },
    { label: "branchId=A", args: (f) => [{ ...FILTERS, branchId: f.a }], who: ADMIN_ONLY_SCOPED },
  ],
  "analytics.getFilterOptions": [
    { args: () => [], who: ADMIN_ONLY_SCOPED },
    { label: "branchId=A", args: (f) => [{ branchId: f.a }], who: ADMIN_ONLY_SCOPED },
  ],
  "alerts.listAlerts": [
    { args: () => [], who: ADMIN_ONLY_SCOPED },
    { label: "branchId=A", args: (f) => [{ branchId: f.a }], who: ADMIN_ONLY_SCOPED },
  ],
  "alerts.countOpen": [{ args: () => [], who: ADMIN_ONLY_SCOPED }],
  "alerts.updateAlert": [
    { args: (f) => [f.alertId, { status: "contacted" }, 1], who: ADMIN_ONLY_DENIED },
  ],
  "responses.listResponses": [
    { args: () => [FILTERS], who: ADMIN_ONLY_SCOPED },
    { label: "branchId=A", args: (f) => [{ ...FILTERS, branchId: f.a }], who: ADMIN_ONLY_SCOPED },
  ],
  "responses.getResponse": [{ args: (f) => [f.responseId], who: ADMIN_ONLY_DENIED }],
  "responses.editResponse": [{ args: (f) => [f.responseId, {}, 1, STEP], who: ADMIN_ONLY_DENIED }],
  "responses.deleteResponse": [{ args: (f) => [f.responseId, STEP], who: ADMIN_ONLY_DENIED }],
  "responses.restoreResponse": [
    { args: (f) => [f.deletedResponseId, STEP], who: ADMIN_ONLY_DENIED },
  ],
  "responses.listDeleted": [{ args: () => [], who: ADMIN_ONLY_SCOPED }],
  "audit.listAudit": [
    { args: () => [], who: ADMIN_ONLY_SCOPED },
    { label: "branchId=A", args: (f) => [{ branchId: f.a }], who: ADMIN_ONLY_SCOPED },
  ],
  // users: branch admin manages own branch's support users; support nothing
  "users.listUsers": [
    { args: () => [], who: ADMIN_ONLY_SCOPED },
    { label: "branchId=A", args: (f) => [{ branchId: f.a }], who: ADMIN_ONLY_SCOPED },
  ],
  "users.createUser": [
    {
      label: "branchId=A",
      args: (f) => [
        {
          name: "Sneaky",
          email: "sneaky@example.in",
          role: "support",
          branchId: f.a,
          tempPassword: TEMP_PW,
        },
      ],
      // A branch admin's branchId is ignored: the user lands in the admin's own branch (checked below).
      who: [D, D, A, A],
    },
  ],
  "users.updateUser": [{ args: (f) => [f.userId, { name: "Renamed" }], who: ADMIN_ONLY_DENIED }],
  "users.setUserActive": [{ args: (f) => [f.userId, true], who: ADMIN_ONLY_DENIED }],
  "users.resetPassword": [{ args: (f) => [f.userId, TEMP_PW], who: ADMIN_ONLY_DENIED }],
  // branches: everyone reads their own; only the main admin manages
  "branches.listBranches": [{ args: () => [], who: [S, S, S, A] }],
  "branches.createBranch": [{ args: () => [{ name: "Gamma", city: "Madurai" }], who: MAIN_ONLY }],
  "branches.updateBranch": [{ args: (f) => [f.a, { city: "Chennai" }], who: MAIN_ONLY }],
  "branches.setBranchActive": [{ args: (f) => [f.a, true], who: MAIN_ONLY }],
  // advisors: support lists own branch; branch admin manages own branch
  "advisors.listAdvisors": [
    { args: () => [{}], who: [A, S, S, A] },
    { label: "branchId=A", args: (f) => [{ branchId: f.a }], who: [A, S, S, A] },
  ],
  "advisors.createAdvisor": [
    { label: "branchId=A", args: (f) => [{ branchId: f.a, name: "Intruder" }], who: [D, D, D, A] },
  ],
  "advisors.renameAdvisor": [{ args: (f) => [f.advisorId, "Renamed"], who: [D, D, D, A] }],
  "advisors.setAdvisorActive": [{ args: (f) => [f.advisorId, true], who: [D, D, D, A] }],
  // customers: main admin only (G-4)
  "customers.searchCustomers": [{ args: () => [{ phone: "9840012345" }], who: MAIN_ONLY }],
  "customers.exportCustomers": [{ args: (f) => [[f.cardId]], who: MAIN_ONLY }],
  "customers.eraseCustomers": [{ args: (f) => [[f.cardId], STEP], who: MAIN_ONLY }],
};

const DENIAL = new Set(["NOT_FOUND", "FORBIDDEN", "UNAUTHENTICATED"]);

type Env = Awaited<ReturnType<typeof makeServerCtx>>;
type Reply = { ok: boolean; value?: unknown; error?: { code: string } };
type Dispatch = (...args: unknown[]) => Promise<Reply>;

let env: Env;
let fx: Fx;
const users = {} as Record<Actor, SessionUser>;
let markers: string[] = [];

async function seedResponse(visitId: string) {
  const [row] = await env.db
    .insert(responses)
    .values({ visitId, questionsVersion: 2, answers: {}, submissionId: crypto.randomUUID() })
    .returning();
  return must(row);
}

async function seedUsers(a: string, b: string): Promise<void> {
  const mk = async (role: SessionUser["role"], branchId: string | null): Promise<SessionUser> => ({
    id: await seedUser(env.db, { role, branchId }),
    name: `${role} user`,
    email: `${role}@example.in`,
    role,
    branchId,
    mustSetPassword: false,
  });
  users.supportA = await mk("support", a);
  users.supportB = await mk("support", b);
  users.adminB = await mk("branch_admin", b);
  users.main = await mk("main_admin", null);
}

beforeAll(async () => {
  env = await makeServerCtx();
  const now = env.clock.now();
  const a = await seedBranch(env.db, "Alpha Velachery");
  const b = await seedBranch(env.db, "Beta Tambaram");
  const s1 = await seedLink(env.db, { branchId: a, no: "JC-ALPHA-1", now });
  const s2 = await seedLink(env.db, { branchId: a, no: "JC-ALPHA-2", now });
  await seedLink(env.db, { branchId: b, no: "JC-BETA-1", now });
  const live = await seedResponse(s1.visitId);
  const gone = await seedResponse(s2.visitId);
  await env.db.update(responses).set({ deletedAt: now }).where(eq(responses.id, gone.id));
  const [alert] = await env.db
    .insert(alerts)
    .values({ responseId: live.id, branchId: a, reasons: [{ kind: "callback" }], notes: [] })
    .returning();
  await env.db.insert(auditLog).values({
    actorName: "Alpha Admin",
    branchId: a,
    action: "link.create",
    entityType: "visit",
    entityId: s1.visitId,
    at: now,
    note: "alpha-audit-note",
  });
  const [advisor] = await env.db.select().from(advisors).where(eq(advisors.branchId, a));
  fx = {
    a,
    cardNo: "JC-ALPHA-1",
    cardId: s1.cardId,
    visitId: s1.visitId,
    responseId: live.id,
    deletedResponseId: gone.id,
    alertId: must(alert).id,
    advisorId: must(advisor).id,
    userId: s1.userId,
  };
  markers = [a, "Alpha", "JC-ALPHA", "alpha-audit-note", ...Object.values<string>(fx).slice(1)];
  await seedUsers(a, b);
});
afterAll(async () => {
  await env.client.close();
});

function call(actor: Actor, method: string, args: unknown[]): Promise<Reply> {
  const user = users[actor];
  const ctx: RequestCtx = {
    ...env.ctx,
    session: {
      sessionId: `s-${actor}`,
      createdAt: env.clock.now(),
      lastActiveAt: env.clock.now(),
      user,
    },
    scope: scopeOf(user),
  };
  const [repo, name] = method.split(".") as [string, string];
  const access = createServerDataAccess(ctx) as unknown as Record<string, Record<string, Dispatch>>;
  const fn = access[repo]?.[name];
  if (!fn) throw new Error(`no such method ${method}`);
  return fn(...args);
}

function whoOf(c: Call, actor: Actor): Expect {
  return typeof c.who === "string" ? c.who : (c.who[ORDER.indexOf(actor)] ?? "any");
}

function leaked(r: Reply): string | null {
  const text = JSON.stringify(r.ok ? (r.value ?? null) : null);
  return markers.find((m) => text.includes(m)) ?? null;
}

function verdict(want: Expect, r: Reply): void {
  const code = r.ok ? null : (r.error?.code ?? "");
  if (want === "stub") expect(code).toBe("UNAVAILABLE");
  if (want === "denied") expect(["NOT_FOUND", "FORBIDDEN"]).toContain(code);
  if (want === "blocked") expect(r.ok).toBe(false);
  if (want === "scoped") expect(r.ok).toBe(true);
  if (want === "allowed") expect(DENIAL.has(code ?? "")).toBe(false);
}

describe("scope matrix: registry and rows agree (a new method without a row fails)", () => {
  const registry = Object.entries(rpcTables).flatMap(([repo, t]) =>
    Object.keys(t).map((m) => `${repo}.${m}`),
  );
  it("every registry method has a matrix row", () => {
    expect(registry.filter((m) => !(m in rows)).sort()).toEqual([]);
  });
  it("every matrix row is a registry method", () => {
    expect(
      Object.keys(rows)
        .filter((m) => !registry.includes(m))
        .sort(),
    ).toEqual([]);
  });
});

describe("scope matrix: every RPC method as support, other-branch admin and main admin (LLD §19)", () => {
  for (const [method, calls] of Object.entries(rows)) {
    for (const c of calls) {
      for (const actor of ACTORS) {
        const want = whoOf(c, actor);
        const label = c.label ? ` (${c.label})` : "";
        it(`${method}${label} as ${actor} -> ${want}`, async () => {
          const r = await call(actor, method, c.args(fx));
          verdict(want, r);
          const outside = actor === "supportB" || actor === "adminB";
          if (outside && !method.startsWith("feedback.")) {
            expect(leaked(r), `${method} leaked`).toBeNull();
          }
        });
      }
    }
  }
});

describe("scope matrix: an out-of-scope erase removes nothing", () => {
  it("support and branch admins calling eraseCustomers leave branch A's customer intact", async () => {
    for (const actor of ["supportA", "supportB", "adminB"] as const) {
      const r = await call(actor, "customers.eraseCustomers", [[fx.cardId], STEP]);
      expect(r.ok).toBe(false);
      expect(["NOT_FOUND", "FORBIDDEN"]).toContain(r.error?.code);
    }
    const [card] = await env.db.select().from(jobCards).where(eq(jobCards.id, fx.cardId));
    expect(must(card).customerName).not.toBeNull();
    expect(must(card).phone).not.toBeNull();
  });
});

describe("scope matrix: a branchId argument never widens a branch user's scope", () => {
  const widened = Object.entries(rows).filter(([, cs]) =>
    cs.some((c) => c.label?.startsWith("branchId")),
  );
  it("has a branchId=A row for every method that takes a branchId", () => {
    expect(widened.map(([m]) => m).sort()).toEqual(
      [
        "advisors.createAdvisor",
        "advisors.listAdvisors",
        "alerts.listAlerts",
        "analytics.getAnalytics",
        "analytics.getFilterOptions",
        "audit.listAudit",
        "responses.listResponses",
        "users.createUser",
        "users.listUsers",
      ].sort(),
    );
  });
  it("a branch-B admin asking for branch A gets nothing of A", async () => {
    for (const [method, cs] of widened) {
      for (const c of cs.filter((x) => x.label?.startsWith("branchId"))) {
        const r = await call("adminB", method, c.args(fx));
        expect(leaked(r), `${method} leaked`).toBeNull();
      }
    }
  });
  it("createAdvisor is refused and createUser lands in the admin's own branch, never in A", async () => {
    const adv = await call("adminB", "advisors.createAdvisor", [{ branchId: fx.a, name: "Z1" }]);
    const usr = await call("adminB", "users.createUser", [
      {
        name: "Z2",
        email: "z2@example.in",
        role: "support",
        branchId: fx.a,
        tempPassword: TEMP_PW,
      },
    ]);
    expect(adv.ok).toBe(false);
    expect(usr.ok).toBe(true);
    const made = await env.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, "z2@example.in"));
    expect(made.map((u) => u.branchId)).toEqual([users.adminB.branchId]);
    const inA = await env.db.select().from(advisors).where(eq(advisors.branchId, fx.a));
    expect(inA.map((x) => x.name)).not.toContain("Z1");
  });
});
