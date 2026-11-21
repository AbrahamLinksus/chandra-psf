/* eslint-disable max-lines-per-function -- describe blocks group many one-line tests */
import { describe, expect, it } from "vitest";
import { Browser, openSecondTab, resetDemo, signInAs, FIXED_NOW } from "../../support";
import { appendAudit } from "@/data/local/repos/auditWriter";
import { SaveFailed } from "@/data/local/store";
import { guardWrite } from "@/data/local/results";
import type { AuditEntry } from "@/domain/types";

const entry = (note: string): Omit<AuditEntry, "id" | "at"> => ({
  actorId: "u-admin",
  actorName: "Admin",
  action: "user.create",
  entityType: "user",
  entityId: "u-x",
  oldValue: null,
  newValue: null,
  note,
});

describe("LocalStore persistence (G-02)", () => {
  it("seeds on first use: 1 admin, 2 support, 4 advisors, JC-24-1042", async () => {
    const tab = new Browser().openTab();
    await tab.store.whenReady();
    const users = tab.store.read("users");
    expect(users.filter((u) => u.role === "admin")).toHaveLength(1);
    expect(users.filter((u) => u.role === "support")).toHaveLength(2);
    expect(tab.store.read("advisors")).toHaveLength(4);
    expect(tab.store.read("jobCards").map((j) => j.jobCardNo)).toContain("JC-24-1042");
    expect(users.every((u) => u.passwordHash.length === 64)).toBe(true);
  });

  it("data written is still there from a new store instance on the same storage", async () => {
    const browser = new Browser();
    const a = browser.openTab();
    await a.store.mutate(["audit"], (d) => appendAudit(d, entry("kept"), FIXED_NOW));
    const reloaded = browser.openTab();
    await reloaded.store.whenReady();
    expect(reloaded.store.read("audit").map((e) => e.note)).toContain("kept");
    expect(reloaded.store.read("users")).toHaveLength(3);
  });

  it("resetDemo wipes written data and the session, then reseeds", async () => {
    const tab = new Browser().openTab();
    await tab.store.whenReady();
    const baseline = tab.store.read("audit").length;
    await tab.store.mutate(["audit"], (d) => appendAudit(d, entry("gone"), FIXED_NOW));
    signInAs(tab, "admin");
    await resetDemo(tab);
    expect(tab.store.read("audit")).toHaveLength(baseline);
    expect(tab.store.read("audit").map((e) => e.note)).not.toContain("gone");
    expect(tab.store.readSession()).toBeNull();
    expect(tab.store.read("users")).toHaveLength(3);
  });

  it("signInAs sets the session and read of a corrupt session gives null", () => {
    const browser = new Browser();
    const tab = browser.openTab();
    signInAs(tab, "support1");
    expect(tab.store.readSession()).toEqual({ userId: "u-support1" });
    browser.storage.setItem("psf:v1:session", "{not json");
    expect(tab.store.readSession()).toBeNull();
  });
});

describe("two tabs (S-06)", () => {
  it("concurrent writes in two tabs never drop each other's data", async () => {
    const browser = new Browser();
    const a = browser.openTab();
    const b = openSecondTab(browser);
    await Promise.all([
      ...Array.from({ length: 5 }, (_, i) =>
        a.store.mutate(["audit"], (d) => appendAudit(d, entry(`a${String(i)}`), FIXED_NOW)),
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        b.store.mutate(["audit"], (d) => appendAudit(d, entry(`b${String(i)}`), FIXED_NOW)),
      ),
    ]);
    const notes = a.store
      .read("audit")
      .map((e) => e.note)
      .filter((n) => n !== undefined && /^[ab]\d$/.test(n));
    expect(notes).toHaveLength(10);
    expect(new Set(notes).size).toBe(10);
  });

  it("a write in one tab emits the topic on the other tab's bus (cross-tab refresh)", async () => {
    const browser = new Browser();
    const a = browser.openTab();
    const b = openSecondTab(browser);
    await a.store.whenReady();
    b.events.length = 0;
    a.events.length = 0;
    await a.store.mutate(["audit"], (d) => appendAudit(d, entry("x"), FIXED_NOW));
    expect(a.events).toContainEqual(["audit"]);
    expect(b.events).toContainEqual(["audit"]);
  });

  it("a storage event with a null key refreshes every topic", () => {
    const tab = new Browser().openTab();
    tab.win.dispatchEvent(Object.assign(new Event("storage"), { key: null }));
    expect(tab.events.at(-1)).toHaveLength(6);
  });
});

describe("simulated failed save (S-13)", () => {
  it("armed fault makes the next mutate throw SaveFailed and the write is not stored", async () => {
    const tab = new Browser().openTab();
    await tab.store.whenReady();
    const baseline = tab.store.read("audit").length;
    tab.fault.armNextWrite();
    await expect(
      tab.store.mutate(["audit"], (d) => appendAudit(d, entry("lost"), FIXED_NOW)),
    ).rejects.toBeInstanceOf(SaveFailed);
    expect(tab.store.read("audit")).toHaveLength(baseline);
  });

  it("only the next write fails; the retry succeeds", async () => {
    const tab = new Browser().openTab();
    await tab.store.whenReady();
    const baseline = tab.store.read("audit").length;
    tab.fault.armNextWrite();
    const write = () =>
      guardWrite(async () => {
        await tab.store.mutate(["audit"], (d) => appendAudit(d, entry("retry"), FIXED_NOW));
        return { ok: true as const, value: undefined };
      });
    const first = await write();
    expect(first.ok).toBe(false);
    if (!first.ok) {
      expect(first.error.code).toBe("SAVE_FAILED");
      expect(first.error.message).toBe("Couldn't save, try again");
    }
    expect((await write()).ok).toBe(true);
    expect(tab.store.read("audit")).toHaveLength(baseline + 1);
  });

  it("?demoFail=1 arms the switch; other queries do not", () => {
    const tab = new Browser().openTab();
    tab.fault.armFromSearch("?demoFail=0");
    expect(tab.fault.consume()).toBe(false);
    tab.fault.armFromSearch("?demoFail=1");
    expect(tab.fault.consume()).toBe(true);
    expect(tab.fault.consume()).toBe(false);
  });

  it("a storage quota error becomes SaveFailed and rolls back", async () => {
    const tab = new Browser().openTab();
    await tab.store.whenReady();
    const baseline = tab.store.read("audit").length;
    const original = tab.storage.setItem.bind(tab.storage);
    tab.storage.setItem = (k: string, v: string) => {
      if (k === "psf:v1:audit") throw new DOMException("full", "QuotaExceededError");
      original(k, v);
    };
    await expect(
      tab.store.mutate(["audit"], (d) => appendAudit(d, entry("big"), FIXED_NOW)),
    ).rejects.toBeInstanceOf(SaveFailed);
    expect(tab.store.read("audit")).toHaveLength(baseline);
  });
});
