/* eslint-disable max-lines-per-function -- describe blocks group many one-line tests */
import { describe, expect, it } from "vitest";
import { Browser, fixedClock, resetDemo, signInAs } from "../../support";
import { LocalAnalyticsRepo } from "@/data/local/repos/analytics";
import { StoreSessionReader } from "@/data/local/session";
import { defaultFilters } from "@/domain/metrics/filters";

async function setup(who: "admin" | "support1" | null) {
  const browser = new Browser();
  const tab = browser.openTab();
  await tab.store.whenReady();
  if (who !== null) signInAs(tab, who);
  const clock = fixedClock();
  const repo = new LocalAnalyticsRepo({
    store: tab.store,
    clock,
    session: new StoreSessionReader(tab.store),
  });
  return { tab, repo, clock };
}

describe("LocalAnalyticsRepo permissions (G-W2, AC-6)", () => {
  it("a support session gets FORBIDDEN from getAnalytics and getFilterOptions", async () => {
    const { repo, clock } = await setup("support1");
    const a = await repo.getAnalytics(defaultFilters(clock.now()));
    const o = await repo.getFilterOptions();
    expect(a.ok ? null : a.error.code).toBe("FORBIDDEN");
    expect(o.ok ? null : o.error.code).toBe("FORBIDDEN");
  });

  it("no session → UNAUTHENTICATED", async () => {
    const { repo, clock } = await setup(null);
    const a = await repo.getAnalytics(defaultFilters(clock.now()));
    expect(a.ok ? null : a.error.code).toBe("UNAUTHENTICATED");
  });

  it("from after to → VALIDATION", async () => {
    const { repo } = await setup("admin");
    const a = await repo.getAnalytics({ from: "2026-03-10", to: "2026-03-01" });
    expect(a.ok ? null : a.error.code).toBe("VALIDATION");
  });

  it("a store failure → UNAVAILABLE, not a throw", async () => {
    const { repo, tab, clock } = await setup("admin");
    tab.storage.setItem("psf:v1:responses", "not json");
    const a = await repo.getAnalytics(defaultFilters(clock.now()));
    expect(a.ok ? null : a.error.code).toBe("UNAVAILABLE");
  });
});

describe("LocalAnalyticsRepo with seed data (AC-10, S-07, S-09, S-11)", () => {
  it("default last 30 days has responses, advisors with names and open alerts", async () => {
    const { repo, clock } = await setup("admin");
    const r = await repo.getAnalytics(defaultFilters(clock.now()));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.kpis.responses.value).toBeGreaterThan(0);
    expect(r.value.advisors.length).toBeGreaterThan(0);
    expect(r.value.advisors.every((a) => a.name !== a.advisorId)).toBe(true);
    expect(r.value.kpis.responseRate.value).not.toBeNull();
    expect(r.value.categoryScores).toHaveLength(5);
  });

  it("a deleted response no longer counts (S-09)", async () => {
    const { repo, tab, clock } = await setup("admin");
    const f = { from: "2000-01-01", to: "2100-01-01" };
    const before = await repo.getAnalytics(f);
    await tab.store.mutate(["responses"], (d) => {
      const first = d.responses[0];
      if (first) first.deletedAt = clock.now().toISOString();
    });
    const after = await repo.getAnalytics(f);
    if (!before.ok || !after.ok) throw new Error("expected ok");
    expect(after.value.kpis.responses.value).toBe((before.value.kpis.responses.value ?? 0) - 1);
  });

  it("each filter narrows the responses; a filter matching nothing gives null (S-10)", async () => {
    const { repo } = await setup("admin");
    const all = { from: "2000-01-01", to: "2100-01-01" };
    const opts = await repo.getFilterOptions();
    if (!opts.ok) throw new Error("expected ok");
    const base = await repo.getAnalytics(all);
    const scooter = await repo.getAnalytics({ ...all, vehicleType: "scooter" });
    const none = await repo.getAnalytics({ ...all, model: "No such model" });
    if (!base.ok || !scooter.ok || !none.ok) throw new Error("expected ok");
    expect(opts.value.models.length).toBeGreaterThan(1);
    expect(opts.value.vehicleTypes.sort()).toEqual(["motorcycle", "scooter"]);
    expect(scooter.value.kpis.responses.value).toBeLessThan(base.value.kpis.responses.value ?? 0);
    expect(none.value.kpis.responses.value).toBeNull();
    const advisor = opts.value.advisors[0];
    const byAdvisor = await repo.getAnalytics({ ...all, advisorId: advisor?.id ?? "" });
    if (!byAdvisor.ok) throw new Error("expected ok");
    expect(byAdvisor.value.advisors.map((a) => a.advisorId)).toEqual([advisor?.id]);
  });

  it("reset restores the seed numbers", async () => {
    const { repo, tab, clock } = await setup("admin");
    await resetDemo(tab, clock);
    signInAs(tab, "admin");
    const r = await repo.getAnalytics(defaultFilters(clock.now()));
    expect(r.ok).toBe(true);
  });
});
