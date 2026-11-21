/* eslint-disable max-lines-per-function -- describe blocks group many one-line tests */
import { describe, expect, it } from "vitest";
import { Browser, FIXED_NOW, fixedClock, type Tab } from "../../support";
import { hashPassword } from "@/data/local/crypto";
import { LocalAuthRepo } from "@/data/local/repos/auth";
import { LocalDemoRepo } from "@/data/local/repos/demo";
import { StoreSessionReader } from "@/data/local/session";

const PASSWORD = "Demo@2026";
const SUPPORT1 = "support1@chandrahonda.demo";

async function setup(): Promise<{
  browser: Browser;
  tab: Tab;
  auth: LocalAuthRepo;
  demo: LocalDemoRepo;
}> {
  const browser = new Browser();
  const tab = browser.openTab();
  await tab.store.whenReady();
  const deps = {
    store: tab.store,
    clock: fixedClock(),
    session: new StoreSessionReader(tab.store),
  };
  return { browser, tab, auth: new LocalAuthRepo(deps), demo: new LocalDemoRepo(deps) };
}

describe("sign in (G-01, G-W1)", () => {
  it("'Sign in as Support 1' and 'Sign in as Admin' start the right session", async () => {
    const { auth } = await setup();
    const s = await auth.signInAsDemo("support1");
    expect(s.ok && s.value.role).toBe("support");
    expect(s.ok && s.value.email).toBe(SUPPORT1);
    const a = await auth.signInAsDemo("admin");
    expect(a.ok && a.value.role).toBe("admin");
    const me = await auth.currentUser();
    expect(me.ok && me.value?.id).toBe("u-admin");
  });

  it("support1 email plus the demo password works (email is case and space tolerant)", async () => {
    const { auth } = await setup();
    const r = await auth.signIn(`  ${SUPPORT1.toUpperCase()} `, PASSWORD);
    expect(r.ok && r.value.id).toBe("u-support1");
    expect(r.ok && "passwordHash" in r.value).toBe(false);
  });

  it("a wrong password says 'Email or password is incorrect' and starts no session", async () => {
    const { auth } = await setup();
    const r = await auth.signIn(SUPPORT1, "nope-nope");
    expect(r).toEqual({
      ok: false,
      error: { code: "BAD_CREDENTIALS", message: "Email or password is incorrect" },
    });
    expect(await auth.currentUser()).toEqual({ ok: true, value: null });
  });

  it("an unknown email gets the same message", async () => {
    const { auth } = await setup();
    const r = await auth.signIn("ghost@chandrahonda.demo", PASSWORD);
    expect(!r.ok && r.error.message).toBe("Email or password is incorrect");
  });

  it("a deactivated user sees 'Account disabled, contact admin' for both sign-in paths", async () => {
    const { auth, tab } = await setup();
    await tab.store.mutate(["users"], (d) => {
      for (const u of d.users) if (u.id === "u-support1") u.active = false;
    });
    const byEmail = await auth.signIn(SUPPORT1, PASSWORD);
    expect(byEmail).toEqual({
      ok: false,
      error: { code: "ACCOUNT_DISABLED", message: "Account disabled, contact admin" },
    });
    const byPicker = await auth.signInAsDemo("support1");
    expect(!byPicker.ok && byPicker.error.code).toBe("ACCOUNT_DISABLED");
    expect(tab.store.readSession()).toBeNull();
  });

  it("passwords are stored only as hashes", async () => {
    const { browser, tab } = await setup();
    const users = tab.store.read("users");
    const hash = await hashPassword(PASSWORD);
    expect(users.every((u) => u.passwordHash === hash)).toBe(true);
    for (const key of ["users", "audit", "meta"]) {
      expect(browser.storage.getItem(`psf:v1:${key}`) ?? "").not.toContain(PASSWORD);
    }
  });

  it("Sign out ends the session", async () => {
    const { auth, tab } = await setup();
    await auth.signInAsDemo("admin");
    expect(tab.store.readSession()).toEqual({ userId: "u-admin" });
    expect(await auth.signOut()).toEqual({ ok: true, value: undefined });
    expect(tab.store.readSession()).toBeNull();
    expect(await auth.currentUser()).toEqual({ ok: true, value: null });
  });
});

describe("set your password (G-05, S-15)", () => {
  async function mustSet(): Promise<Awaited<ReturnType<typeof setup>>> {
    const ctx = await setup();
    await ctx.tab.store.mutate(["users"], (d) => {
      for (const u of d.users) if (u.id === "u-support1") u.mustSetPassword = true;
    });
    await ctx.auth.signInAsDemo("support1");
    return ctx;
  }

  it("the signed-in user carries mustSetPassword so the app sends them to Set your password", async () => {
    const { auth } = await mustSet();
    const me = await auth.currentUser();
    expect(me.ok && me.value?.mustSetPassword).toBe(true);
  });

  it("under 8 characters is refused and nothing is saved", async () => {
    const { auth, tab } = await mustSet();
    const before = tab.store.read("users").find((u) => u.id === "u-support1");
    const auditBefore = tab.store.read("audit").length;
    const r = await auth.setOwnPassword("short12");
    expect(!r.ok && r.error.code).toBe("VALIDATION");
    expect(!r.ok && r.error.message).toBe("Use at least 8 characters");
    expect(tab.store.read("users").find((u) => u.id === "u-support1")).toEqual(before);
    expect(tab.store.read("audit")).toHaveLength(auditBefore);
  });

  it("without a session it answers UNAUTHENTICATED", async () => {
    const { auth } = await setup();
    const r = await auth.setOwnPassword("longenough1");
    expect(!r.ok && r.error.code).toBe("UNAUTHENTICATED");
  });

  it("a valid password is saved as a hash, clears the flag, and audits user.set_password", async () => {
    const { auth, tab } = await mustSet();
    const r = await auth.setOwnPassword("brand-new-pass");
    expect(r.ok && r.value.mustSetPassword).toBe(false);
    const stored = tab.store.read("users").find((u) => u.id === "u-support1");
    expect(stored?.passwordHash).toBe(await hashPassword("brand-new-pass"));
    expect(stored?.mustSetPassword).toBe(false);
    const entry = tab.store.read("audit").find((e) => e.action === "user.set_password");
    expect(entry).toMatchObject({
      actorId: "u-support1",
      entityType: "user",
      entityId: "u-support1",
      oldValue: { mustSetPassword: true },
      newValue: { mustSetPassword: false },
      at: FIXED_NOW.toISOString(),
    });
    expect(JSON.stringify(entry)).not.toContain("brand-new-pass");
    expect((await auth.signIn(SUPPORT1, "brand-new-pass")).ok).toBe(true);
    expect((await auth.signIn(SUPPORT1, PASSWORD)).ok).toBe(false);
  });

  it("a failed save leaves the old password in place", async () => {
    const { auth, tab } = await mustSet();
    tab.fault.armNextWrite();
    const r = await auth.setOwnPassword("brand-new-pass");
    expect(!r.ok && r.error.code).toBe("SAVE_FAILED");
    expect((await auth.signIn(SUPPORT1, PASSWORD)).ok).toBe(true);
  });
});

describe("demo reset and simulated failure (US-22, S-06, S-13)", () => {
  it("reset wipes every psf key, restores the seed and ends the session in every tab", async () => {
    const { browser, tab, auth, demo } = await setup();
    const other = browser.openTab();
    await other.store.whenReady();
    await auth.signInAsDemo("admin");
    expect(other.store.readSession()).toEqual({ userId: "u-admin" });
    const seededUsers = tab.store.read("users").length;
    await tab.store.mutate(["users"], (d) => {
      d.users.length = 0;
    });
    browser.storage.setItem("psf:v1:stray", "left-over");
    expect(await demo.resetDemoData()).toEqual({ ok: true, value: undefined });
    expect(browser.storage.getItem("psf:v1:stray")).toBeNull();
    expect(tab.store.readSession()).toBeNull();
    expect(other.store.readSession()).toBeNull();
    expect(tab.store.read("users")).toHaveLength(seededUsers);
    expect((await auth.signIn(SUPPORT1, PASSWORD)).ok).toBe(true);
  });

  it("'Simulate failed save' makes the next write fail once, then writes work again", async () => {
    const { auth, demo } = await setup();
    expect(await demo.armFailedSave()).toEqual({ ok: true, value: undefined });
    await auth.signInAsDemo("support1");
    const first = await auth.setOwnPassword("another-pass1");
    expect(!first.ok && first.error.message).toBe("Couldn't save, try again");
    const second = await auth.setOwnPassword("another-pass1");
    expect(second.ok).toBe(true);
  });

  it("a storage failure during sign out is reported as a failed save", async () => {
    const { auth, tab } = await setup();
    await auth.signInAsDemo("admin");
    tab.storage.removeItem = () => {
      throw new Error("boom");
    };
    const r = await auth.signOut();
    expect(!r.ok && r.error.code).toBe("SAVE_FAILED");
  });
});
