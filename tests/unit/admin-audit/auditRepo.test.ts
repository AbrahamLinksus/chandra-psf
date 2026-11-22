/* eslint-disable max-lines-per-function -- describe blocks group many one-line tests */
import { describe, expect, it } from "vitest";
import { Browser, fixedClock, resetDemo, signInAs } from "../../support";
import { LocalAuditRepo } from "@/data/local/repos/audit";
import { appendAudit } from "@/data/local/repos/auditWriter";
import { StoreSessionReader } from "@/data/local/session";

async function setup(who: "admin" | "support1" | null = "admin") {
  const tab = new Browser().openTab();
  await tab.store.whenReady();
  if (who !== null) signInAs(tab, who);
  const repo = new LocalAuditRepo({
    store: tab.store,
    clock: fixedClock(),
    session: new StoreSessionReader(tab.store),
  });
  return { tab, repo };
}

describe("audit list (US-19)", () => {
  it("lists seeded entries newest first", async () => {
    const { repo } = await setup();
    const r = await repo.listAudit();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.length).toBeGreaterThan(0);
    const times = r.value.map((e) => e.at);
    expect(times).toEqual([...times].sort().reverse());
  });

  it("filters by action and includes a newly appended entry first", async () => {
    const { tab, repo } = await setup();
    await tab.store.mutate(["audit"], (d) => {
      appendAudit(
        d,
        {
          actorId: "u-admin",
          actorName: "Admin",
          action: "user.create",
          entityType: "user",
          entityId: "x",
          oldValue: null,
          newValue: { a: 1 },
        },
        new Date("2099-01-01T00:00:00.000Z"),
      );
    });
    const all = await repo.listAudit();
    expect(all.ok && all.value[0]?.entityId).toBe("x");
    const some = await repo.listAudit({ action: "user.create" });
    expect(
      some.ok && some.value.length > 0 && some.value.every((e) => e.action === "user.create"),
    ).toBe(true);
    if (all.ok && some.ok) expect(some.value.length).toBeLessThanOrEqual(all.value.length);
  });

  it("after a reset the seeded entries are listed again and earlier entries are gone", async () => {
    const { tab, repo } = await setup();
    await tab.store.mutate(["audit"], (d) => {
      appendAudit(
        d,
        {
          actorId: "u-admin",
          actorName: "Admin",
          action: "user.create",
          entityType: "user",
          entityId: "before-reset",
          oldValue: null,
          newValue: null,
        },
        new Date("2099-01-01T00:00:00.000Z"),
      );
    });
    const seeded = await repo.listAudit();
    await resetDemo(tab);
    signInAs(tab, "admin");
    const r = await repo.listAudit();
    expect(r.ok && r.value.length).toBeGreaterThan(0);
    if (!r.ok || !seeded.ok) return;
    expect(r.value.some((e) => e.entityId === "before-reset")).toBe(false);
    expect(r.value.length).toBe(seeded.value.length - 1);
    expect(r.value.map((e) => e.action)).toContain("alert.status");
  });

  it("exposes no write method", async () => {
    const { repo } = await setup();
    expect(Object.getOwnPropertyNames(repo).filter((k) => k !== "deps")).toEqual(["listAudit"]);
  });

  it("returns FORBIDDEN for support and UNAUTHENTICATED without a session (G-W2)", async () => {
    const s = await setup("support1");
    const r = await s.repo.listAudit();
    expect(!r.ok && r.error.code).toBe("FORBIDDEN");
    const n = await setup(null);
    const r2 = await n.repo.listAudit();
    expect(!r2.ok && r2.error.code).toBe("UNAUTHENTICATED");
  });
});
