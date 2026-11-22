/* eslint-disable max-lines-per-function -- describe blocks group many one-line tests */
import { describe, expect, it } from "vitest";
import { Browser, fixedClock, signInAs } from "../../support";
import { LocalAlertRepo } from "@/data/local/repos/alerts";
import { StoreSessionReader } from "@/data/local/session";

async function setup(who: "admin" | "support1" | null = "admin") {
  const browser = new Browser();
  const tab = browser.openTab();
  await tab.store.whenReady();
  if (who !== null) signInAs(tab, who);
  const repo = new LocalAlertRepo({
    store: tab.store,
    clock: fixedClock(),
    session: new StoreSessionReader(tab.store),
  });
  return { tab, repo };
}

describe("alerts list and badge (AC-8)", () => {
  it("lists newest first with customer, vehicle and reasons text", async () => {
    const { repo } = await setup();
    const r = await repo.listAlerts();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.length).toBeGreaterThan(0);
    const times = r.value.map((a) => a.createdAt);
    expect(times).toEqual([...times].sort().reverse());
    for (const a of r.value) {
      expect(a.customerName).not.toBe("");
      expect(a.reasonsText).not.toBe("");
    }
  });

  it("filters by status and the open count matches the open rows", async () => {
    const { repo } = await setup();
    const open = await repo.listAlerts({ status: "open" });
    const count = await repo.countOpen();
    expect(open.ok && count.ok && open.value.every((a) => a.status === "open")).toBe(true);
    expect(count.ok && open.ok && count.value).toBe(open.ok ? open.value.length : -1);
  });

  it("hides alerts of deleted responses and leaves them out of the count", async () => {
    const { tab, repo } = await setup();
    const before = await repo.listAlerts();
    if (!before.ok) throw new Error("list failed");
    const victim = before.value.find((a) => a.status === "open");
    if (victim === undefined) throw new Error("no open alert in seed");
    const countBefore = await repo.countOpen();
    await tab.store.mutate(["responses"], (d) => {
      const resp = d.responses.find((x) => x.id === victim.responseId);
      if (resp) resp.deletedAt = "2026-03-09T00:00:00.000Z";
    });
    const after = await repo.listAlerts();
    expect(after.ok && after.value.some((a) => a.id === victim.id)).toBe(false);
    const countAfter = await repo.countOpen();
    expect(countAfter.ok && countBefore.ok && countAfter.value).toBe(
      countBefore.ok ? countBefore.value - (victim.status === "open" ? 1 : 0) : -1,
    );
    const upd = await repo.updateAlert(victim.id, { status: "resolved" });
    expect(!upd.ok && upd.error.code).toBe("NOT_FOUND");
  });
});

describe("alert changes (AC-8, S-13)", () => {
  async function firstOpen() {
    const s = await setup();
    const r = await s.repo.listAlerts({ status: "open" });
    if (!r.ok || r.value[0] === undefined) throw new Error("no open alert in seed");
    return { ...s, alert: r.value[0] };
  }

  it("status plus note writes both audit entries, adds the note and lowers the open count", async () => {
    const { tab, repo, alert } = await firstOpen();
    const before = await repo.countOpen();
    const r = await repo.updateAlert(alert.id, {
      status: "contacted",
      note: "  Called, bike rechecked 22 Nov ",
    });
    expect(r.ok && r.value.status).toBe("contacted");
    expect(r.ok && r.value.notes.at(-1)?.text).toBe("Called, bike rechecked 22 Nov");
    const audit = tab.store.read("audit").filter((a) => a.entityId === alert.id);
    expect(audit.map((a) => a.action)).toEqual(["alert.status", "alert.note"]);
    expect([audit[0]?.oldValue, audit[0]?.newValue]).toEqual(["open", "contacted"]);
    const after = await repo.countOpen();
    expect(before.ok && after.ok && after.value).toBe(before.ok ? before.value - 1 : -1);
  });

  it("a resolved alert can be reopened", async () => {
    const { repo, alert } = await firstOpen();
    await repo.updateAlert(alert.id, { status: "resolved" });
    const r = await repo.updateAlert(alert.id, { status: "open" });
    expect(r.ok && r.value.status).toBe("open");
  });

  it("an unchanged status writes no audit entry", async () => {
    const { tab, repo, alert } = await firstOpen();
    const n = tab.store.read("audit").length;
    await repo.updateAlert(alert.id, { status: "open", note: "Still pending" });
    const added = tab.store
      .read("audit")
      .slice(n)
      .map((a) => a.action);
    expect(added).toEqual(["alert.note"]);
  });

  it("rejects an empty patch, a blank note and an unknown id", async () => {
    const { repo, alert } = await firstOpen();
    const a = await repo.updateAlert(alert.id, {});
    const b = await repo.updateAlert(alert.id, { note: "   " });
    const c = await repo.updateAlert("nope", { status: "open" });
    expect([a, b, c].map((x) => (x.ok ? "ok" : x.error.code))).toEqual([
      "VALIDATION",
      "VALIDATION",
      "NOT_FOUND",
    ]);
  });

  it("a failed save returns SAVE_FAILED and changes nothing (S-13)", async () => {
    const { tab, repo, alert } = await firstOpen();
    const n = tab.store.read("audit").length;
    tab.fault.armNextWrite();
    const r = await repo.updateAlert(alert.id, { status: "contacted", note: "typed note" });
    expect(!r.ok && r.error.code).toBe("SAVE_FAILED");
    expect(!r.ok && r.error.message).toBe("Couldn't save, try again");
    expect(tab.store.read("audit")).toHaveLength(n);
    expect(tab.store.read("alerts").find((a) => a.id === alert.id)?.status).toBe("open");
  });
});

describe("alert access (G-W2)", () => {
  it("support gets FORBIDDEN from every method", async () => {
    const { repo } = await setup("support1");
    const results = [
      await repo.listAlerts(),
      await repo.countOpen(),
      await repo.updateAlert("x", { status: "open" }),
    ];
    expect(results.map((r) => (r.ok ? "ok" : r.error.code))).toEqual([
      "FORBIDDEN",
      "FORBIDDEN",
      "FORBIDDEN",
    ]);
  });

  it("signed out gets UNAUTHENTICATED", async () => {
    const { repo } = await setup(null);
    const r = await repo.countOpen();
    expect(!r.ok && r.error.code).toBe("UNAUTHENTICATED");
  });
});
