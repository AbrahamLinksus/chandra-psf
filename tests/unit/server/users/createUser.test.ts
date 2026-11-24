// @vitest-environment node
/* eslint-disable max-lines-per-function -- describe blocks group many one-line tests */
import { describe, expect, it, vi } from "vitest";
import { seedBranch, seedUser } from "../../../support/serverCtx";
import {
  TEMP,
  add,
  asBranchAdmin,
  asMainAdmin,
  asSupport,
  audits,
  code,
  env,
  message,
  repo,
  row,
} from "./harness";

vi.mock("server-only", () => ({}));
const { ServerAuthRepo } = await import("@/server/repos/auth");

describe("createUser (S-15, G-01, G-05)", () => {
  it("a Velachery admin adds arun@chandrahonda.in as support in their own branch, even if another branch is sent", async () => {
    const velachery = await seedBranch(env.db, "Velachery");
    const tambaram = await seedBranch(env.db, "Tambaram");
    await asBranchAdmin(velachery);
    const r = await repo().createUser({
      name: "Arun",
      email: "arun@chandrahonda.in",
      role: "support",
      branchId: tambaram,
      tempPassword: TEMP,
    });
    expect(r.ok && r.value).toMatchObject({
      role: "support",
      branchId: velachery,
      branchName: "Velachery",
      mustSetPassword: true,
    });
  });

  it("a branch admin cannot add a branch admin or main admin (FORBIDDEN)", async () => {
    const velachery = await seedBranch(env.db, "Velachery");
    await asBranchAdmin(velachery);
    for (const role of ["branch_admin", "main_admin"] as const) {
      const r = await repo().createUser({
        name: "X",
        email: `${role}@chandrahonda.in`,
        role,
        branchId: velachery,
        tempPassword: TEMP,
      });
      expect(code(r)).toBe("FORBIDDEN");
    }
    expect(await audits("user.create")).toHaveLength(0);
  });

  it("the main admin adds any role: a main admin has no branch, others need one", async () => {
    const tambaram = await seedBranch(env.db, "Tambaram");
    await asMainAdmin();
    const main = await repo().createUser({
      name: "Meena",
      email: "meena@chandrahonda.in",
      role: "main_admin",
      branchId: tambaram,
      tempPassword: TEMP,
    });
    expect(main.ok && main.value.branchId).toBeNull();
    const ba = await repo().createUser({
      name: "Bala",
      email: "bala@chandrahonda.in",
      role: "branch_admin",
      branchId: tambaram,
      tempPassword: TEMP,
    });
    expect(ba.ok && ba.value).toMatchObject({ role: "branch_admin", branchName: "Tambaram" });
    const none = await repo().createUser({
      name: "Sam",
      email: "sam@chandrahonda.in",
      role: "support",
      branchId: null,
      tempPassword: TEMP,
    });
    expect(code(none)).toBe("VALIDATION");
    expect(message(none)).toBe("Choose a branch");
  });

  it("with no active branch the main admin gets 'Add a branch first'; once one exists an inactive branch is refused", async () => {
    await asMainAdmin();
    const input = { name: "Arun", email: "arun@chandrahonda.in", tempPassword: TEMP };
    const r = await repo().createUser({ ...input, role: "support", branchId: null });
    expect(message(r)).toBe("Add a branch first");
    const closed = await seedBranch(env.db, "Closed", false);
    const r2 = await repo().createUser({ ...input, role: "support", branchId: closed });
    expect(message(r2)).toBe("Add a branch first");
    await seedBranch(env.db, "Open");
    const r3 = await repo().createUser({ ...input, role: "support", branchId: closed });
    expect(message(r3)).toBe("Choose an active branch");
  });

  it("a duplicate email, in any letter case, is EMAIL_IN_USE 'Email already in use'", async () => {
    const b = await seedBranch(env.db, "Velachery");
    await asMainAdmin();
    await add({ email: "arun@chandrahonda.in", role: "support", branchId: b });
    const r = await repo().createUser({
      name: "Other",
      email: " ARUN@chandrahonda.IN ",
      role: "support",
      branchId: b,
      tempPassword: TEMP,
    });
    expect(code(r)).toBe("EMAIL_IN_USE");
    expect(message(r)).toBe("Email already in use");
  });

  it("trims and lower-cases email and name, forces 'Set your password' at first sign-in, never audits the password", async () => {
    const b = await seedBranch(env.db, "Velachery");
    await asMainAdmin();
    const id = await add({
      name: "  Arun K ",
      email: "  Arun@ChandraHonda.IN ",
      role: "support",
      branchId: b,
    });
    const saved = await row(id);
    expect(saved).toMatchObject({ email: "arun@chandrahonda.in", name: "Arun K" });
    expect(saved.mustSetPassword).toBe(true);
    expect(saved.otpExpiresAt).not.toBeNull();

    const signed = await new ServerAuthRepo(env.ctx).signIn("arun@chandrahonda.in", TEMP);
    expect(signed.ok && signed.value.mustSetPassword).toBe(true);

    const [created] = await audits("user.create");
    expect(JSON.stringify(created)).not.toContain(TEMP);
    expect(created?.newValue).toMatchObject({ email: "arun@chandrahonda.in", role: "support" });
  });

  it("a bad name, email or weak password is a VALIDATION error and nothing is saved", async () => {
    const b = await seedBranch(env.db, "Velachery");
    await asMainAdmin();
    const base = { role: "support" as const, branchId: b };
    const mk = (name: string, email: string, tempPassword: string) =>
      repo().createUser({ ...base, name, email, tempPassword });
    expect(message(await mk(" ", "a@b.in", TEMP))).toBe("Enter a name");
    expect(message(await mk("A", "bad", TEMP))).toBe("Enter a valid email address");
    expect(message(await mk("A", "a@b.in", "1234567"))).toBe("Use at least 8 characters");
    expect(code(await mk("A", "a@b.in", "password"))).toBe("VALIDATION");
    expect(await audits("user.create")).toHaveLength(0);
  });

  it("support is FORBIDDEN to add, list or touch users (US-29)", async () => {
    const b = await seedBranch(env.db, "Velachery");
    await asSupport(b);
    const target = await seedUser(env.db, { role: "support", branchId: b });
    const r = await repo().createUser({
      name: "A",
      email: "a@b.in",
      role: "support",
      branchId: b,
      tempPassword: TEMP,
    });
    expect(code(r)).toBe("FORBIDDEN");
    expect(code(await repo().listUsers())).toBe("FORBIDDEN");
    expect(code(await repo().updateUser(target, { name: "Z" }))).toBe("FORBIDDEN");
    expect(code(await repo().setUserActive(target, false))).toBe("FORBIDDEN");
    expect(code(await repo().resetPassword(target, TEMP))).toBe("FORBIDDEN");
  });
});
