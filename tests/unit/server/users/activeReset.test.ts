// @vitest-environment node
/* eslint-disable max-lines-per-function -- describe blocks group many one-line tests */
import { describe, expect, it, vi } from "vitest";
import { insertSession } from "@/server/auth/session";
import { loginAttempts } from "@/server/db/schema";
import { seedBranch, seedUser } from "../../../support/serverCtx";
import {
  LAST_ADMIN,
  TEMP,
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
const { ServerAuthRepo } = await import("@/server/repos/auth");

describe("setUserActive and resetPassword (US-27, S-18, S-27)", () => {
  it("deactivate ends the sessions at once, is audited, reactivate restores; a repeat is a no-op", async () => {
    const v = await seedBranch(env.db, "Velachery");
    await asMainAdmin();
    const arun = await add({ email: "arun@chandrahonda.in", role: "support", branchId: v });
    await insertSession(env.db, env.clock, arun);
    const off = await repo().setUserActive(arun, false);
    expect(off.ok && off.value.active).toBe(false);
    expect(await sessionCount(arun)).toBe(0);
    await repo().setUserActive(arun, false);
    expect(await audits("user.deactivate")).toHaveLength(1);
    const on = await repo().setUserActive(arun, true);
    expect(on.ok && on.value.active).toBe(true);
    expect(await audits("user.reactivate")).toHaveLength(1);
  });

  it("the last active main admin cannot be deactivated (CONFLICT); with a second one it can", async () => {
    await asMainAdmin(false);
    const lone = await seedUser(env.db, { role: "main_admin" });
    const r = await repo().setUserActive(lone, false);
    expect(code(r)).toBe("CONFLICT");
    expect(message(r)).toBe(LAST_ADMIN);
    expect((await row(lone)).active).toBe(true);
    await seedUser(env.db, { role: "main_admin" });
    expect((await repo().setUserActive(lone, false)).ok).toBe(true);
  });

  it("reset while Priya is signed in: sessions end, temp password asks to 'Set your password', her lock clears, audit has no password", async () => {
    const v = await seedBranch(env.db, "Velachery");
    await asMainAdmin();
    const priya = await add({ email: "priya@chandrahonda.in", role: "support", branchId: v });
    await insertSession(env.db, env.clock, priya);
    const auth = new ServerAuthRepo(env.ctx);
    for (let i = 0; i < 5; i++) await auth.signIn("priya@chandrahonda.in", "wrong-pass-1");
    const locked = await auth.signIn("priya@chandrahonda.in", TEMP);
    expect(code(locked)).toBe("RATE_LIMITED");

    const NEW_TEMP = "Fresh-Temp-5521";
    expect((await repo().resetPassword(priya, NEW_TEMP)).ok).toBe(true);
    expect(await sessionCount(priya)).toBe(0);
    const left = (await env.db.select().from(loginAttempts)).filter(
      (a) => a.emailKey === "priya@chandrahonda.in",
    );
    expect(left).toHaveLength(0);

    const next = await auth.signIn("priya@chandrahonda.in", NEW_TEMP);
    expect(next.ok && next.value.mustSetPassword).toBe(true);
    expect((await row(priya)).otpExpiresAt).not.toBeNull();

    const [a] = await audits("user.reset_password");
    expect(a?.entityId).toBe(priya);
    expect(JSON.stringify(a)).not.toContain(NEW_TEMP);
    expect(JSON.stringify(a)).not.toContain(TEMP);
  });

  it("a weak temporary password is refused and changes nothing", async () => {
    const v = await seedBranch(env.db, "Velachery");
    await asMainAdmin();
    const priya = await add({ email: "priya@chandrahonda.in", role: "support", branchId: v });
    expect(code(await repo().resetPassword(priya, "short"))).toBe("VALIDATION");
    expect(await audits("user.reset_password")).toHaveLength(0);
  });

  it("a branch admin resets and deactivates their own support users but not a peer or themselves", async () => {
    const v = await seedBranch(env.db, "Velachery");
    await asMainAdmin();
    const arun = await add({ email: "arun@chandrahonda.in", role: "support", branchId: v });
    const peer = await add({ email: "bala@chandrahonda.in", role: "branch_admin", branchId: v });
    const boss = await asBranchAdmin(v);
    expect((await repo().resetPassword(arun, TEMP)).ok).toBe(true);
    expect((await repo().setUserActive(arun, false)).ok).toBe(true);
    expect(code(await repo().resetPassword(peer, TEMP))).toBe("FORBIDDEN");
    expect(code(await repo().setUserActive(boss, false))).toBe("FORBIDDEN");
  });
});

describe("branch scope (US-29, S-19, G-W2)", () => {
  it("a branch admin opening another branch's user gets NOT_FOUND 'Not found' on every action", async () => {
    const v = await seedBranch(env.db, "Velachery");
    const t = await seedBranch(env.db, "Tambaram");
    const stranger = await seedUser(env.db, { role: "support", branchId: t });
    await asBranchAdmin(v);
    for (const r of [
      await repo().updateUser(stranger, { name: "X" }),
      await repo().setUserActive(stranger, false),
      await repo().resetPassword(stranger, TEMP),
    ]) {
      expect(code(r)).toBe("NOT_FOUND");
      expect(message(r)).toBe("Not found");
    }
    expect((await row(stranger)).active).toBe(true);
  });

  it("listUsers shows a branch admin only their branch, and the main admin everyone (filterable)", async () => {
    const v = await seedBranch(env.db, "Velachery");
    const t = await seedBranch(env.db, "Tambaram");
    await seedUser(env.db, { role: "support", branchId: v, email: "v@x.in" });
    await seedUser(env.db, { role: "support", branchId: t, email: "t@x.in" });
    await asBranchAdmin(v);
    const mine = await repo().listUsers({ branchId: t });
    expect(mine.ok && mine.value.map((u) => u.email)).not.toContain("t@x.in");
    await asMainAdmin();
    const all = await repo().listUsers();
    expect(all.ok && all.value.length).toBeGreaterThanOrEqual(3);
    const only = await repo().listUsers({ branchId: t });
    expect(only.ok && only.value.map((u) => u.email)).toEqual(["t@x.in"]);
  });
});
