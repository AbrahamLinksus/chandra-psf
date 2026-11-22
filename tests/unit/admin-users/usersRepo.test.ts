/* eslint-disable max-lines-per-function -- describe blocks group many one-line tests */
import { describe, expect, it } from "vitest";
import { Browser, fixedClock, signInAs } from "../../support";
import { LocalAuthRepo } from "@/data/local/repos/auth";
import { LocalUserRepo } from "@/data/local/repos/users";
import { StoreSessionReader } from "@/data/local/session";

async function setup(who: "admin" | "support1" | "support2" | null = "admin") {
  const browser = new Browser();
  const tab = browser.openTab();
  await tab.store.whenReady();
  if (who !== null) signInAs(tab, who);
  const deps = {
    store: tab.store,
    clock: fixedClock(),
    session: new StoreSessionReader(tab.store),
  };
  return { tab, users: new LocalUserRepo(deps), auth: new LocalAuthRepo(deps), deps };
}

const DEEPA = { name: "Deepa R.", email: "deepa@chandrahonda.demo", tempPassword: "Welcome@1" };

describe("add support user (S-15, G-01, G-05)", () => {
  it("s15 adds Deepa, lists her, audits user.create, and her first sign-in must set a password", async () => {
    const { tab, users, auth } = await setup();
    const r = await users.createSupportUser(DEEPA);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toMatchObject({ role: "support", active: true, mustSetPassword: true });
    expect(JSON.stringify(r.value)).not.toContain("Welcome@1");
    const list = await users.listUsers();
    expect(list.ok && list.value.map((u) => u.email)).toContain("deepa@chandrahonda.demo");
    const audit = tab.store.read("audit").filter((a) => a.action === "user.create");
    expect(audit).toHaveLength(1);
    expect(audit[0]?.entityId).toBe(r.value.id);
    expect(JSON.stringify(audit[0])).not.toContain("Welcome@1");

    const signed = await auth.signIn("deepa@chandrahonda.demo", "Welcome@1");
    expect(signed.ok && signed.value.mustSetPassword).toBe(true);
    const set = await auth.setOwnPassword("MyOwnPass1");
    expect(set.ok && set.value.mustSetPassword).toBe(false);
  });

  it("rejects an existing email, in any case, with EMAIL_IN_USE 'Email already in use' (G-01)", async () => {
    const { tab, users } = await setup();
    const r = await users.createSupportUser({ ...DEEPA, email: "SUPPORT1@chandrahonda.demo" });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "EMAIL_IN_USE", message: "Email already in use" },
    });
    expect(tab.store.read("audit").some((a) => a.action === "user.create")).toBe(false);
  });

  it.each([
    ["empty name", { ...DEEPA, name: "  " }, "name"],
    ["invalid email", { ...DEEPA, email: "not-an-email" }, "email"],
    ["7-char temp password", { ...DEEPA, tempPassword: "1234567" }, "tempPassword"],
  ])("rejects %s with VALIDATION (G-05)", async (_n, input, field) => {
    const { tab, users } = await setup();
    const before = tab.store.read("users").length;
    const r = await users.createSupportUser(input);
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDATION", fields: [field] } });
    expect(tab.store.read("users")).toHaveLength(before);
  });

  it("accepts an 8-character temp password (boundary)", async () => {
    const { users } = await setup();
    expect((await users.createSupportUser({ ...DEEPA, tempPassword: "12345678" })).ok).toBe(true);
  });

  it("a failed save returns an error and changes nothing (S-13)", async () => {
    const { tab, users } = await setup();
    const before = tab.store.read("users").length;
    tab.fault.armNextWrite();
    const r = await users.createSupportUser(DEEPA);
    expect(r.ok).toBe(false);
    expect(tab.store.read("users")).toHaveLength(before);
  });
});

describe("deactivate and reactivate (S-15)", () => {
  it("deactivating Support 2 drops his open session and blocks his next sign-in", async () => {
    const { tab, deps, auth } = await setup("support2");
    const cur = await auth.currentUser();
    expect(cur.ok && cur.value?.id).toBe("u-support2");

    const adminUser = tab.store.read("users").find((u) => u.id === "u-admin");
    const asAdmin = new LocalUserRepo({
      ...deps,
      session: { current: () => (adminUser ? { ...adminUser } : null) },
    });
    const r = await asAdmin.setUserActive("u-support2", false);
    expect(r.ok && r.value.active).toBe(false);

    const after = await auth.currentUser();
    expect(after.ok && after.value).toBeNull();
    expect(await auth.signInAsDemo("support2")).toMatchObject({
      ok: false,
      error: { code: "ACCOUNT_DISABLED", message: "Account disabled, contact admin" },
    });
  });

  it("a created user who is deactivated gets 'Account disabled' on password sign-in; reactivate restores access; each change audited", async () => {
    const { tab, users, auth } = await setup();
    const c = await users.createSupportUser(DEEPA);
    if (!c.ok) throw new Error("create failed");
    expect((await users.setUserActive(c.value.id, false)).ok).toBe(true);
    expect(await auth.signIn(DEEPA.email, DEEPA.tempPassword)).toMatchObject({
      ok: false,
      error: { code: "ACCOUNT_DISABLED", message: "Account disabled, contact admin" },
    });
    expect((await users.setUserActive(c.value.id, true)).ok).toBe(true);
    expect((await auth.signIn(DEEPA.email, DEEPA.tempPassword)).ok).toBe(true);
    const actions = tab.store.read("audit").map((a) => a.action);
    expect(actions).toContain("user.deactivate");
    expect(actions).toContain("user.reactivate");
  });

  it("repeating the same state writes no extra audit row", async () => {
    const { tab, users } = await setup();
    await users.setUserActive("u-support2", true);
    expect(tab.store.read("audit").some((a) => a.action === "user.reactivate")).toBe(false);
  });

  it("the admin cannot deactivate themself", async () => {
    const { tab, users } = await setup();
    const r = await users.setUserActive("u-admin", false);
    expect(r).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(tab.store.read("users").find((u) => u.id === "u-admin")?.active).toBe(true);
  });

  it("an unknown id returns NOT_FOUND", async () => {
    const { users } = await setup();
    expect(await users.setUserActive("nope", false)).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
  });
});

describe("access control (G-W2)", () => {
  it("a support session gets FORBIDDEN on list, create and deactivate", async () => {
    const { tab, users } = await setup("support1");
    const before = tab.store.read("users").length;
    for (const r of [
      await users.listUsers(),
      await users.createSupportUser(DEEPA),
      await users.setUserActive("u-support2", false),
    ]) {
      expect(r).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    }
    expect(tab.store.read("users")).toHaveLength(before);
  });

  it("no session gets UNAUTHENTICATED", async () => {
    const { users } = await setup(null);
    for (const r of [
      await users.listUsers(),
      await users.createSupportUser(DEEPA),
      await users.setUserActive("u-support2", false),
    ]) {
      expect(r).toMatchObject({ ok: false, error: { code: "UNAUTHENTICATED" } });
    }
  });
});
