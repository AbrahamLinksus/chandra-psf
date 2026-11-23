// @vitest-environment node
/* eslint-disable max-lines-per-function -- describe blocks group many one-line tests */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auditLog, sessions, users } from "@/server/db/schema";
import type { SessionUser } from "@/server/ctx";
import { makeServerCtx, must, seedBranch, seedUser } from "../../../support/serverCtx";

vi.mock("server-only", () => ({}));

const { ServerBranchRepo } = await import("@/server/repos/branches");
const { ServerAdvisorRepo } = await import("@/server/repos/advisors");

const GHOST = "00000000-0000-0000-0000-000000000000";
type Env = Awaited<ReturnType<typeof makeServerCtx>>;
let env: Env;

beforeEach(async () => {
  env = await makeServerCtx();
});
afterEach(async () => {
  await env.client.close();
});

function signIn(user: Partial<SessionUser> & Pick<SessionUser, "id" | "role">): void {
  env.ctx.session = {
    sessionId: "s",
    createdAt: env.clock.now(),
    lastActiveAt: env.clock.now(),
    user: {
      name: "Boss",
      email: "boss@chandra.in",
      branchId: null,
      mustSetPassword: false,
      ...user,
    },
  };
}

async function asMainAdmin(): Promise<void> {
  signIn({ id: await seedUser(env.db, { role: "main_admin" }), role: "main_admin" });
}
async function asBranchAdmin(branchId: string): Promise<void> {
  const id = await seedUser(env.db, { role: "branch_admin", branchId });
  signIn({ id, role: "branch_admin", branchId });
}
async function asSupport(branchId: string): Promise<void> {
  signIn({ id: await seedUser(env.db, { role: "support", branchId }), role: "support", branchId });
}
const audits = async (action: string) =>
  (await env.db.select().from(auditLog)).filter((a) => a.action === action);
const branchRepo = () => new ServerBranchRepo(env.ctx);
const advisorRepo = () => new ServerAdvisorRepo(env.ctx);

async function newBranch(name: string): Promise<string> {
  const r = await branchRepo().createBranch({ name, city: "Chennai" });
  return must(r.ok ? r.value.id : null);
}
async function newAdvisor(branchId: string, name: string): Promise<string> {
  const r = await advisorRepo().createAdvisor({ branchId, name });
  return must(r.ok ? r.value.id : null);
}

describe("BranchRepo (US-23, US-24)", () => {
  it("main admin adds Velachery and Chennai, trimmed, listed by name and audited", async () => {
    await asMainAdmin();
    const a = await branchRepo().createBranch({ name: "  Velachery ", city: "Chennai" });
    expect(a.ok && a.value.name).toBe("Velachery");
    await newBranch("Chennai");
    const list = await branchRepo().listBranches();
    expect(list.ok && list.value.map((b) => b.name)).toEqual(["Chennai", "Velachery"]);
    expect(await audits("branch.create")).toHaveLength(2);
  });

  it("a duplicate name, in any letter case, is NAME_IN_USE with the exact message", async () => {
    await asMainAdmin();
    await newBranch("Velachery");
    const r = await branchRepo().createBranch({ name: "velachery", city: "Madurai" });
    expect(!r.ok && r.error.code).toBe("NAME_IN_USE");
    expect(!r.ok && r.error.message).toBe("A branch with this name already exists");
    expect(await audits("branch.create")).toHaveLength(1);
  });

  it("an empty name or city is a VALIDATION error", async () => {
    await asMainAdmin();
    const r = await branchRepo().createBranch({ name: "  ", city: "Chennai" });
    expect(!r.ok && r.error.code).toBe("VALIDATION");
  });

  it("renames, rejects a name taken by another branch, allows keeping its own, audits old and new", async () => {
    await asMainAdmin();
    const v = await newBranch("Velachery");
    await newBranch("Adyar");
    const clash = await branchRepo().updateBranch(v, { name: "ADYAR" });
    expect(!clash.ok && clash.error.code).toBe("NAME_IN_USE");
    const same = await branchRepo().updateBranch(v, { name: "Velachery", city: "Madras" });
    expect(same.ok && same.value.city).toBe("Madras");
    const renamed = await branchRepo().updateBranch(v, { name: "Velachery East" });
    expect(renamed.ok && renamed.value.name).toBe("Velachery East");
    const last = (await audits("branch.update")).slice(-1)[0];
    expect(last?.oldValue).toMatchObject({ name: "Velachery" });
    expect(last?.newValue).toMatchObject({ name: "Velachery East" });
  });

  it("an unknown branch id is NOT_FOUND", async () => {
    await asMainAdmin();
    const r = await branchRepo().setBranchActive(GHOST, false);
    expect(!r.ok && r.error.code).toBe("NOT_FOUND");
  });

  it("deactivate / reactivate keeps the row, audits each, and a repeat is a no-op", async () => {
    await asMainAdmin();
    const id = await seedBranch(env.db, "Velachery");
    const off = await branchRepo().setBranchActive(id, false);
    expect(off.ok && off.value.active).toBe(false);
    await branchRepo().setBranchActive(id, false);
    const on = await branchRepo().setBranchActive(id, true);
    expect(on.ok && on.value.active).toBe(true);
    expect(await audits("branch.deactivate")).toHaveLength(1);
    expect(await audits("branch.reactivate")).toHaveLength(1);
    const list = await branchRepo().listBranches();
    expect(list.ok && list.value).toHaveLength(1);
  });

  it("deactivating ends the branch staff's sessions only, keeps their rows, and counts active staff", async () => {
    await asMainAdmin();
    const a = await seedBranch(env.db, "Velachery");
    const b = await seedBranch(env.db, "Adyar");
    const staffA = await seedUser(env.db, { role: "support", branchId: a });
    const staffB = await seedUser(env.db, { role: "support", branchId: b });
    await env.db.insert(sessions).values([
      { idHash: Buffer.from("a"), userId: staffA },
      { idHash: Buffer.from("b"), userId: staffB },
    ]);
    const before = await branchRepo().listBranches();
    expect(before.ok && before.value.find((x) => x.id === a)?.staffCount).toBe(1);
    await branchRepo().setBranchActive(a, false);
    expect((await env.db.select().from(sessions)).map((s) => s.userId)).toEqual([staffB]);
    expect(await env.db.select().from(users)).toHaveLength(3);
  });

  it("a branch admin and support list only their own branch; neither can change branches", async () => {
    const a = await seedBranch(env.db, "Velachery");
    await seedBranch(env.db, "Adyar");
    await asBranchAdmin(a);
    const list = await branchRepo().listBranches();
    expect(list.ok && list.value.map((x) => x.name)).toEqual(["Velachery"]);
    for (const call of [
      () => branchRepo().createBranch({ name: "New", city: "X" }),
      () => branchRepo().updateBranch(a, { name: "New" }),
      () => branchRepo().setBranchActive(a, false),
    ]) {
      const r = await call();
      expect(!r.ok && r.error.code).toBe("FORBIDDEN");
    }
    await asSupport(a);
    const s = await branchRepo().listBranches();
    expect(s.ok && s.value).toHaveLength(1);
    expect(await audits("branch.deactivate")).toHaveLength(0);
  });

  it("without a session every call is UNAUTHENTICATED", async () => {
    const r = await branchRepo().listBranches();
    expect(!r.ok && r.error.code).toBe("UNAUTHENTICATED");
  });
});

describe("AdvisorRepo (US-25)", () => {
  it("adds Suresh, renames, deactivates, reactivates; each audited with the branch", async () => {
    await asMainAdmin();
    const a = await seedBranch(env.db, "Velachery");
    const c = await advisorRepo().createAdvisor({ branchId: a, name: " Suresh " });
    const suresh = must(c.ok ? c.value : null);
    expect(suresh.name).toBe("Suresh");
    const r = await advisorRepo().renameAdvisor(suresh.id, "Suresh K");
    expect(r.ok && r.value.name).toBe("Suresh K");
    const off = await advisorRepo().setAdvisorActive(suresh.id, false);
    expect(off.ok && off.value.active).toBe(false);
    await advisorRepo().setAdvisorActive(suresh.id, false);
    await advisorRepo().setAdvisorActive(suresh.id, true);
    for (const action of [
      "advisor.create",
      "advisor.rename",
      "advisor.deactivate",
      "advisor.reactivate",
    ]) {
      const rows = await audits(action);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.branchId).toBe(a);
    }
  });

  it("a duplicate name in the same branch is NAME_IN_USE; the same name in another branch is fine", async () => {
    await asMainAdmin();
    const a = await seedBranch(env.db, "Velachery");
    const b = await seedBranch(env.db, "Adyar");
    await newAdvisor(a, "Suresh");
    const dup = await advisorRepo().createAdvisor({ branchId: a, name: "suresh" });
    expect(!dup.ok && dup.error.code).toBe("NAME_IN_USE");
    const other = await advisorRepo().createAdvisor({ branchId: b, name: "Suresh" });
    expect(other.ok).toBe(true);
  });

  it("an empty name is VALIDATION and an unknown branch or advisor is NOT_FOUND", async () => {
    await asMainAdmin();
    const a = await seedBranch(env.db, "Velachery");
    const empty = await advisorRepo().createAdvisor({ branchId: a, name: " " });
    expect(!empty.ok && empty.error.code).toBe("VALIDATION");
    const noBranch = await advisorRepo().createAdvisor({ branchId: GHOST, name: "X" });
    expect(!noBranch.ok && noBranch.error.code).toBe("NOT_FOUND");
    const noAdvisor = await advisorRepo().renameAdvisor(GHOST, "X");
    expect(!noAdvisor.ok && noAdvisor.error.code).toBe("NOT_FOUND");
  });

  it("a branch admin manages only their branch: others' advisors and branches are NOT_FOUND", async () => {
    const a = await seedBranch(env.db, "Velachery");
    const b = await seedBranch(env.db, "Adyar");
    await asMainAdmin();
    const raviId = await newAdvisor(b, "Ravi");

    await asBranchAdmin(a);
    const own = await advisorRepo().createAdvisor({ branchId: a, name: "Suresh" });
    expect(own.ok).toBe(true);
    const foreign = await advisorRepo().createAdvisor({ branchId: b, name: "Mani" });
    expect(!foreign.ok && foreign.error.code).toBe("NOT_FOUND");
    const rename = await advisorRepo().renameAdvisor(raviId, "Hacked");
    expect(!rename.ok && rename.error.code).toBe("NOT_FOUND");
    const toggle = await advisorRepo().setAdvisorActive(raviId, false);
    expect(!toggle.ok && toggle.error.code).toBe("NOT_FOUND");
    // a requested other branch is ignored: the branch admin still gets their own branch
    const list = await advisorRepo().listAdvisors({ branchId: b });
    expect(list.ok && list.value.map((x) => x.name)).toEqual(["Suresh"]);
  });

  it("main admin lists all branches' advisors with the branch name; activeOnly hides inactive", async () => {
    await asMainAdmin();
    const a = await seedBranch(env.db, "Velachery");
    const b = await seedBranch(env.db, "Adyar");
    await newAdvisor(a, "Suresh");
    await advisorRepo().setAdvisorActive(await newAdvisor(b, "Ravi"), false);
    const all = await advisorRepo().listAdvisors({});
    expect(all.ok && all.value.map((x) => `${x.name}@${x.branchName}`)).toEqual([
      "Ravi@Adyar",
      "Suresh@Velachery",
    ]);
    const active = await advisorRepo().listAdvisors({ activeOnly: true });
    expect(active.ok && active.value.map((x) => x.name)).toEqual(["Suresh"]);
  });

  it("support lists only their own branch's active advisors and cannot change any", async () => {
    const a = await seedBranch(env.db, "Velachery");
    const b = await seedBranch(env.db, "Adyar");
    await asMainAdmin();
    await newAdvisor(a, "Suresh");
    const oldId = await newAdvisor(a, "Old Hand");
    await newAdvisor(b, "Ravi");
    await advisorRepo().setAdvisorActive(oldId, false);

    await asSupport(a);
    const list = await advisorRepo().listAdvisors({ branchId: b });
    expect(list.ok && list.value.map((x) => x.name)).toEqual(["Suresh"]);
    for (const call of [
      () => advisorRepo().createAdvisor({ branchId: a, name: "New" }),
      () => advisorRepo().renameAdvisor(oldId, "New"),
      () => advisorRepo().setAdvisorActive(oldId, true),
    ]) {
      const r = await call();
      expect(!r.ok && r.error.code).toBe("FORBIDDEN");
    }
  });
});
