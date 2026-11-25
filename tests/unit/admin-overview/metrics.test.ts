/* eslint-disable max-lines-per-function -- describe blocks group many one-line tests */
import { describe, expect, it } from "vitest";
import { computeOverview } from "@/domain/metrics/overview";
import { defaultFilters, matches, previousPeriod } from "@/domain/metrics/filters";
import { categoryScore, ratingScore, yesNoScore } from "@/domain/metrics/scores";
import type {
  AnalyticsInput,
  AnswerMap,
  Filters,
  JobCard,
  ResponseRecord,
  Visit,
} from "@/domain/types";

const NOW = new Date("2026-03-10T06:30:00.000Z");
const F: Filters = { from: "2026-02-09", to: "2026-03-10" };

function card(n: number, over: Partial<JobCard> = {}): JobCard {
  return {
    jobCardNo: `JC-${String(n)}`,
    customerName: "A",
    phone: null,
    regNo: "R",
    model: "Activa",
    vehicleType: "scooter",
    serviceType: "Paid",
    serviceDate: "2026-03-01",
    advisorId: "a1",
    ...over,
  };
}

function visit(n: number, over: Partial<Visit> = {}): Visit {
  return {
    id: `v${String(n)}`,
    jobCardNo: `JC-${String(n)}`,
    phone: null,
    token: "t",
    createdBy: "u",
    createdAt: "2026-03-01T00:00:00.000Z",
    expiresAt: "2026-03-08T00:00:00.000Z",
    openedAt: null,
    completedAt: null,
    cancelledAt: null,
    replacedBy: null,
    ...over,
  };
}

function response(n: number, answers: AnswerMap, submittedAt = "2026-03-02T00:00:00.000Z") {
  const rec: ResponseRecord = {
    id: `r${String(n)}`,
    visitId: `v${String(n)}`,
    questionsVersion: 1,
    submittedAt,
    answers,
    deletedAt: null,
  };
  return rec;
}

interface Row {
  card?: Partial<JobCard>;
  visit?: Partial<Visit>;
  answers?: AnswerMap;
  submittedAt?: string;
}

/** One entry per visit; `answers` present means a live response. */
function build(rows: Row[], openAlerts = 0): AnalyticsInput {
  const visits = rows.map((r, i) => ({
    visit: visit(i, {
      ...(r.answers ? { completedAt: "2026-03-02T00:00:00.000Z" } : {}),
      ...r.visit,
    }),
    jobCard: card(i, r.card),
  }));
  const responses = rows.flatMap((r, i) => {
    const v = visits[i];
    return r.answers && v ? [{ response: response(i, r.answers, r.submittedAt), ...v }] : [];
  });
  return { visits, responses, openAlerts, now: NOW };
}

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
      i < 30 ? { answers: { Q12: 5 } } : {},
    );
    expect(computeOverview(build(rows), F).kpis.responseRate.value).toBe(75);
  });

  it("cancelled and replaced visits are left out of both numbers (S-14)", () => {
    const rows: Row[] = [
      { answers: { Q12: 5 } },
      {},
      { visit: { cancelledAt: "2026-03-02T00:00:00.000Z" } },
      { visit: { replacedBy: "v9" } },
    ];
    expect(computeOverview(build(rows), F).kpis.responseRate.value).toBe(50);
  });

  it("a visit whose response was deleted does not count as completed (S-09)", () => {
    const input = build([{ answers: { Q12: 5 } }, { answers: { Q12: 4 } }]);
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
      { answers: { Q12: 5, Q13: "Yes" } },
      { answers: { Q12: 3, Q13: "No" }, card: { serviceDate: "2026-01-20" } },
    ];
    const k = computeOverview(build(rows, 3), F).kpis;
    expect(k.avgQ12).toEqual({ value: 5, previous: 3, delta: 2 });
    expect(k.recommendRate).toEqual({ value: 100, previous: 0, delta: 100 });
    expect(k.responses).toEqual({ value: 1, previous: 1, delta: 0 });
    expect(k.openAlerts).toBe(3);
  });

  it("no previous data → delta is null (arrow hidden)", () => {
    const k = computeOverview(build([{ answers: { Q12: 4 } }]), F).kpis;
    expect(k.avgQ12.previous).toBeNull();
    expect(k.avgQ12.delta).toBeNull();
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
    const rows: Row[] = [{ answers: { Q12: 5 }, submittedAt: "2025-01-01T00:00:00.000Z" }];
    expect(computeOverview(build(rows), F).kpis.responses.value).toBe(1);
  });
});

describe("no data (S-10)", () => {
  it("a filter matching nothing gives null everywhere, never 0, NaN or Infinity", () => {
    const data = computeOverview(build([{ answers: { Q12: 5, Q13: "Yes" } }]), {
      ...F,
      model: "Nothing",
    });
    const { openAlerts, ...rest } = data.kpis;
    expect(openAlerts).toBe(0);
    for (const m of Object.values(rest))
      expect(m).toEqual({ value: null, previous: null, delta: null });
    expect(data.categoryScores.every((c) => c.score === null)).toBe(true);
    expect(data.trend.points).toEqual([]);
    expect(data.advisors).toEqual([]);
    expect(data.questionDetail).toEqual([]);
    expect(data.comments).toEqual([]);
    expect(Object.values(data.problems).every((p) => p.length === 0)).toBe(true);
    expect(JSON.stringify(data)).not.toMatch(/NaN|Infinity/);
  });
});

describe("blocks (US-15, AC-10)", () => {
  const rows: Row[] = [
    {
      answers: {
        Q1: 5,
        Q4: "Yes",
        Q6: 4,
        Q6a: { options: ["Other"] },
        Q7: "No",
        Q12: 5,
        Q13: "Yes",
      },
    },
    {
      answers: {
        Q1: 2,
        Q1a: { options: ["Other"], text: "bad <script>" },
        Q4: "No",
        Q6: 2,
        Q7: "Yes",
        Q12: 3,
      },
      card: { advisorId: "a2" },
      submittedAt: "2026-03-05T00:00:00.000Z",
    },
  ];
  const data = computeOverview(build(rows), F, { a1: "Suresh" });

  it("advisor rows carry names (fallback to id) and per-advisor numbers", () => {
    expect(data.advisors).toEqual(
      [
        { advisorId: "a2", name: "a2", responses: 1, avgQ6: 2, q4Yes: 0, q7Yes: 100, avgQ12: 3 },
        {
          advisorId: "a1",
          name: "Suresh",
          responses: 1,
          avgQ6: 4,
          q4Yes: 100,
          q7Yes: 0,
          avgQ12: 5,
        },
      ].sort((a, b) => a.name.localeCompare(b.name)),
    );
  });

  // TODO(T-39): v2 metrics
  it("problems count follow-up options (Q1a, Q6a)", () => {
    expect(data.problems.Q1a.find((o) => o.option === "Other")?.count).toBe(1);
    expect(data.problems.Q6a.find((o) => o.option === "Other")?.count).toBe(1);
    expect(data.problems.Q3a.every((o) => o.count === 0)).toBe(true);
  });

  // TODO(T-39): v2 metrics
  it("question detail splits Yes/Partially/No for the v2 yes/no questions", () => {
    expect(data.questionDetail.map((q) => q.code)).toEqual([
      "Q2",
      "Q3",
      "Q5",
      "Q6",
      "Q7",
      "Q9",
      "Q10",
    ]);
    const q7 = data.questionDetail.find((q) => q.code === "Q7");
    expect(q7?.split).toEqual([
      { answer: "Yes", count: 1 },
      { answer: "No", count: 1 },
    ]);
  });

  it("comments are newest first, raw text, with the Q12 rating", () => {
    expect(data.comments[0]).toMatchObject({ text: "bad <script>", source: "Q1a", q12: 3 });
  });

  it("category scores cover the 5 steps", () => {
    expect(data.categoryScores.map((c) => c.step)).toEqual([1, 2, 3, 4, 5]);
    expect(data.categoryScores[0]?.score).toBe(62.5);
  });

  it("trend is weekly (Monday buckets) for a 30-day range and monthly beyond 90 days", () => {
    expect(data.trend.granularity).toBe("week");
    expect(data.trend.points.find((p) => p.bucketStart === "2026-02-23")?.avgQ12).toBe(4);
    const long = computeOverview(build(rows), { from: "2025-12-01", to: "2026-03-10" });
    expect(long.trend.granularity).toBe("month");
    expect(long.trend.points.map((p) => p.bucketStart)).toEqual([
      "2025-12-01",
      "2026-01-01",
      "2026-02-01",
      "2026-03-01",
    ]);
  });

  // TODO(T-39): v2 metrics
  it("only the newest 10 comments are kept", () => {
    const many: Row[] = Array.from({ length: 12 }, () => ({
      answers: { Q12: 4, Q1a: { options: ["Other"], text: "hi" } },
    }));
    expect(computeOverview(build(many), F).comments).toHaveLength(10);
  });
});
