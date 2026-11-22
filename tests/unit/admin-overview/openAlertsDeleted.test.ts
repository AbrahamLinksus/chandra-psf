import { describe, expect, it } from "vitest";
import { Browser, fixedClock, signInAs } from "../../support";
import { LocalAnalyticsRepo } from "@/data/local/repos/analytics";
import { LocalResponseRepo } from "@/data/local/repos/responses";
import { StoreSessionReader } from "@/data/local/session";
import { defaultFilters } from "@/domain/metrics/filters";

const PW = { password: "Demo@2026" };

describe("Overview open alerts vs deleted responses (T-06r)", () => {
  it("deleting a response with an open alert drops the KPI 3 -> 2; restore brings it back", async () => {
    const tab = new Browser().openTab();
    await tab.store.whenReady();
    signInAs(tab, "admin");
    const clock = fixedClock();
    const deps = { store: tab.store, clock, session: new StoreSessionReader(tab.store) };
    const analytics = new LocalAnalyticsRepo(deps);
    const responses = new LocalResponseRepo(deps);
    const open = async (): Promise<number | null> => {
      const r = await analytics.getAnalytics(defaultFilters(clock.now()));
      return r.ok ? r.value.kpis.openAlerts : null;
    };
    expect(
      tab.store.read("alerts").some((a) => a.responseId === "r-s005" && a.status === "open"),
    ).toBe(true);
    expect(await open()).toBe(3);
    expect((await responses.deleteResponse("r-s005", PW)).ok).toBe(true);
    expect(await open()).toBe(2);
    expect((await responses.restoreResponse("r-s005", PW)).ok).toBe(true);
    expect(await open()).toBe(3);
  });
});
