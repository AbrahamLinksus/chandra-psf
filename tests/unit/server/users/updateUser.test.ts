// @vitest-environment node
/* eslint-disable max-lines-per-function -- describe blocks group many one-line tests */
import { describe, expect, it, vi } from "vitest";
import { insertSession } from "@/server/auth/session";
import { seedBranch, seedUser } from "../../../support/serverCtx";
import {
  GHOST,
  LAST_ADMIN,
  add,
  asBranchAdmin,
  asMainAdmin,
  audits,
  code,
  env,
  message,
  repo,
  row,
  sessionCount,
} from "./harness";

vi.mock("server-only", () => ({}));

describe("updateUser (S-20, G-9)", () => {
  it("the main admin changes Arun's email and role: saved, his sessions end, audit old -> new", async () => {
    const b = await seedBranch(env.db, "Velachery");
    await asMainAdmin();
    const arun = await add({ email: "arun@chandrahnda.in", role: "support", branchId: b });
    await insertSession(env.db, env.clock, arun);
    const r = await repo().updateUser(arun, {
      email: "Arun@ChandraHonda.in",
      role: "branch_admin",
    });
    expect(r.ok && r.value).toMatchObject({ email: "arun@chandrahonda.in", role: "branch_admin" });
    expect(await sessionCount(arun)).toBe(0);
    const [a] = await audits("user.update");
    expect(a?.oldValue).toEqual({ email: "arun@chandrahnda.in", role: "support" });
    expect(a?.newValue).toEqual({ email: "arun@chandrahonda.in", role: "branch_admin" });
  });

  it("moving a user to another branch ends the sessions; a name-only edit keeps them", async () => {
    const v = await seedBranch(env.db, "Velachery");
    const t = await seedBranch(env.db, "Tambaram");
    await asMainAdmin();
    const arun = await add({ email: "arun@chandrahonda.in", role: "support", branchId: v });
    await insertSession(env.db, env.clock, arun);
    await repo().updateUser(arun, { name: "Arun Kumar" });
    expect(await sessionCount(arun)).toBe(1);
    const moved = await repo().updateUser(arun, { branchId: t });
    expect(moved.ok && moved.value.branchName).toBe("Tambaram");
    expect(await sessionCount(arun)).toBe(0);
  });

  it("promoting to main admin clears the branch", async () => {
    const v = await seedBranch(env.db, "Velachery");
    await asMainAdmin();
    const id = await add({ email: "meena@chandrahonda.in", role: "branch_admin", branchId: v });
    const r = await repo().updateUser(id, { role: "main_admin" });
    expect(r.ok && r.value.branchId).toBeNull();
  });

  it("an email taken by someone else is EMAIL_IN_USE; an unchanged own email is fine; bad input is VALIDATION", async () => {
    const v = await seedBranch(env.db, "Velachery");
    await asMainAdmin();
    await add({ email: "kavitha@chandrahonda.in", role: "support", branchId: v });
    const arun = await add({ email: "arun@chandrahonda.in", role: "support", branchId: v });
    const clash = await repo().updateUser(arun, { email: "KAVITHA@chandrahonda.in" });
    expect(code(clash)).toBe("EMAIL_IN_USE");
    expect((await repo().updateUser(arun, { email: "arun@chandrahonda.in" })).ok).toBe(true);
    expect(code(await repo().updateUser(arun, { email: "nope" }))).toBe("VALIDATION");
    expect(code(await repo().updateUser(arun, { name: "" }))).toBe("VALIDATION");
  });

  it("moving to an unknown branch is refused; an unknown user is NOT_FOUND", async () => {
    const v = await seedBranch(env.db, "Velachery");
    await asMainAdmin();
    const arun = await add({ email: "arun@chandrahonda.in", role: "support", branchId: v });
    expect(code(await repo().updateUser(arun, { branchId: GHOST }))).toBe("VALIDATION");
    expect(code(await repo().updateUser(GHOST, { name: "Z" }))).toBe("NOT_FOUND");
  });

  it("a branch admin edits only name and email of their own support users", async () => {
    const v = await seedBranch(env.db, "Velachery");
    const t = await seedBranch(env.db, "Tambaram");
    await asMainAdmin();
    const arun = await add({ email: "arun@chandrahonda.in", role: "support", branchId: v });
    const peer = await add({ email: "bala@chandrahonda.in", role: "branch_admin", branchId: v });
    const boss = await asBranchAdmin(v);
    const edited = await repo().updateUser(arun, {
      name: "Arun K",
      email: "arun.k@chandrahonda.in",
    });
    expect(edited.ok && edited.value.name).toBe("Arun K");
    expect(code(await repo().updateUser(arun, { role: "branch_admin" }))).toBe("FORBIDDEN");
    expect(code(await repo().updateUser(arun, { branchId: t }))).toBe("FORBIDDEN");
    expect(code(await repo().updateUser(peer, { name: "Bala B" }))).toBe("FORBIDDEN");
    expect(code(await repo().updateUser(boss, { name: "Me" }))).toBe("FORBIDDEN");
  });

  it("nobody changes their own role, branch or active flag; a main admin may edit their own name", async () => {
    const v = await seedBranch(env.db, "Velachery");
    const me = await asMainAdmin();
    await seedUser(env.db, { role: "main_admin" });
    expect(code(await repo().updateUser(me, { role: "support" }))).toBe("FORBIDDEN");
    expect(code(await repo().updateUser(me, { branchId: v }))).toBe("FORBIDDEN");
    expect(code(await repo().setUserActive(me, false))).toBe("FORBIDDEN");
    const named = await repo().updateUser(me, { name: "Meena S" });
    expect(named.ok && named.value.name).toBe("Meena S");
  });

  it("the last active main admin cannot be demoted; with a second active one it can", async () => {
    const v = await seedBranch(env.db, "Velachery");
    await asMainAdmin(false);
    const lone = await seedUser(env.db, { role: "main_admin" });
    const r = await repo().updateUser(lone, { role: "branch_admin", branchId: v });
    expect(code(r)).toBe("CONFLICT");
    expect(message(r)).toBe(LAST_ADMIN);
    expect((await row(lone)).role).toBe("main_admin");
    await seedUser(env.db, { role: "main_admin" });
    expect((await repo().updateUser(lone, { role: "branch_admin", branchId: v })).ok).toBe(true);
  });
});
