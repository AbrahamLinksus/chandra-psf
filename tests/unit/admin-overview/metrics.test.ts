import { describe, expect, it } from "vitest";
import { computeOverview } from "@/domain/metrics/overview";
import { defaultFilters, matches, previousPeriod } from "@/domain/metrics/filters";
import { categoryScore, ratingScore, yesNoScore } from "@/domain/metrics/scores";
import type { AnswerMap } from "@/domain/types";
import { build, card, F, NOW, type Row } from "./overviewFixtures";

describe("scores (SPEC section 5, F-5)", () => {
  it("Q1 ratings 4, 5, 3 → 75, 100, 50", () => {
    expect([4, 5, 3].map(ratingScore)).toEqual([75, 100, 50]);
  });

  it("Q2 Yes / Partially / No → 100 / 50 / 0", () => {
    expect(["Yes", "Partially", "No"].map((v) => yesNoScore("Q2", v))).toEqual([100, 50, 0]);
  });

  it("Q3 is reversed: No issues = 100", () => {
    expect([yesNoScore("Q3", "No"), yesNoScore("Q3", "Yes")]).toEqual([100, 0]);
  });

  it("Partially on a plain yes/no question or a missing answer → null", () => {
    expect([yesNoScore("Q4", "Partially"), yesNoScore("Q4", undefined)]).toEqual([null, null]);
  });

  it("category score is the mean of the step's answered scores; follow-ups are ignored", () => {
    const answers: AnswerMap = { Q1: 4, Q2: "Partially", Q3: "No", Q1a: { options: ["Other"] } };
    expect(categoryScore(1, answers)).toBeCloseTo((75 + 50 + 100) / 3);
  });

  it("a step with no scoreable answers → null", () => {
    expect(categoryScore(1, {})).toBeNull();
  });
});

describe("response rate (S-09, S-14)", () => {
  it("40 visits with 30 completed → 75 %", () => {
    const rows: Row[] = Array.from({ length: 40 }, (_, i) =>
      i < 30 ? { answers: { Q1: 5 } } : {},
    );
    expect(computeOverview(build(rows), F).kpis.responseRate.value).toBe(75);
  });

  it("cancelled and replaced visits are left out of both numbers (S-14)", () => {
    const rows: Row[] = [
      { answers: { Q1: 5 } },
      {},
      { visit: { cancelledAt: "2026-03-02T00:00:00.000Z" } },
      { visit: { replacedBy: "v9" } },
    ];
    expect(computeOverview(build(rows), F).kpis.responseRate.value).toBe(50);
  });

  it("a visit whose response was deleted does not count as completed (S-09)", () => {
    const input = build([{ answers: { Q1: 5 } }, { answers: { Q1: 4 } }]);
    input.responses.pop();
    expect(computeOverview(input, F).kpis.responseRate.value).toBe(50);
  });
});

describe("KPIs and previous period (US-14)", () => {
  it("previous period is the same length immediately before `from`", () => {
    expect(previousPeriod({ from: "2026-03-01", to: "2026-03-10", model: "Dio" })).toEqual({
      from: "2026-02-19",
      to: "2026-02-28",
      model: "Dio",
    });
  });

  it("delta = value - previous when both periods have data", () => {
    const rows: Row[] = [
      { answers: { Q1: 5, Q9: "Yes" } },
      { answers: { Q1: 3, Q9: "No" }, card: { serviceDate: "2026-01-20" } },
    ];
    const k = computeOverview(build(rows, 3), F).kpis;
    expect(k.avgSatisfaction).toEqual({ value: 5, previous: 3, delta: 2 });
    expect(k.recommendRate).toEqual({ value: 100, previous: 0, delta: 100 });
    expect(k.responses).toEqual({ value: 1, previous: 1, delta: 0 });
    expect(k.openAlerts).toBe(3);
  });

  it("no previous data → delta is null (arrow hidden)", () => {
    const k = computeOverview(build([{ answers: { Q1: 4 } }]), F).kpis;
    expect(k.avgSatisfaction.previous).toBeNull();
    expect(k.avgSatisfaction.delta).toBeNull();
  });
});

describe("filters (S-11)", () => {
  it("every filter and the service-date range narrow the match", () => {
    const c = card(1);
    expect(matches(c, F)).toBe(true);
    expect(matches(c, { ...F, from: "2026-03-02" })).toBe(false);
    expect(matches(c, { ...F, vehicleType: "motorcycle" })).toBe(false);
    expect(matches(c, { ...F, model: "Dio" })).toBe(false);
    expect(matches(c, { ...F, advisorId: "a2" })).toBe(false);
    expect(matches(c, { ...F, model: "Activa", advisorId: "a1", vehicleType: "scooter" })).toBe(
      true,
    );
  });

  it("defaultFilters is the last 30 days ending today in IST", () => {
    expect(defaultFilters(NOW)).toEqual({ from: "2026-02-08", to: "2026-03-10" });
  });

  it("the submit date does not matter, only the service date", () => {
    const rows: Row[] = [{ answers: { Q1: 5 }, submittedAt: "2025-01-01T00:00:00.000Z" }];
    expect(computeOverview(build(rows), F).kpis.responses.value).toBe(1);
  });
});

describe("no data (S-10)", () => {
  it("a filter matching nothing gives null everywhere, never 0, NaN or Infinity", () => {
    const data = computeOverview(build([{ answers: { Q1: 5, Q9: "Yes" } }]), {
      ...F,
      model: "Nothing",
    });
    const { openAlerts, ...rest } = data.kpis;
    expect(openAlerts).toBe(0);
    expect(Object.keys(rest)).toContain("callbacks");
    for (const m of Object.values(rest))
      expect(m).toEqual({ value: null, previous: null, delta: null });
    expect(data.categoryScores.every((c) => c.score === null)).toBe(true);
    expect(data.trend.points).toEqual([]);
    expect(data.advisors).toEqual([]);
    expect(data.categoryScores.every((c) => c.questions.length === 0)).toBe(true);
    expect(JSON.stringify(data)).not.toMatch(/NaN|Infinity/);
  });
});
