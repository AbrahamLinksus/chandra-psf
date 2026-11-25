/* eslint-disable max-lines-per-function -- describe blocks group several tests */
import { describe, expect, it } from "vitest";
import { advisorScore } from "@/domain/metrics/advisorScore";
import { computeOverview } from "@/domain/metrics/overview";
import type { AnswerMap } from "@/domain/types";
import { build, F, type Row } from "./overviewFixtures";

/**
 * Hand-computed fixture (D-47). Per-question averages over the 3 responses:
 * Q4 (100+50+0)/3=50, Q1 (100+75+50)/3=75, Q2 (100+50+0)/3=50, Q7 66.67, Q5 66.67, Q6 66.67, Q9 66.67.
 * Weighted: 50*30 + 75*20 + 50*15 + 66.67*(10+10+10+5) = 1500+1500+750+2333.3 = 6083.3 -> 60.83 -> 61.
 * Q8 (all 1 = 0 points) and Q3 are not weighted, so they must not move the score.
 */
const FIXTURE: AnswerMap[] = [
  { Q1: 5, Q2: "Yes", Q3: "No", Q4: 5, Q5: "Yes", Q6: "Yes", Q7: "Yes", Q8: 1, Q9: "Yes" },
  { Q1: 4, Q2: "Partially", Q3: "Yes", Q4: 3, Q5: "No", Q6: "Yes", Q7: "No", Q8: 1, Q9: "No" },
  { Q1: 3, Q2: "No", Q3: "Yes", Q4: 1, Q5: "Yes", Q6: "No", Q7: "Yes", Q8: 1, Q9: "Yes" },
];

describe("advisor weighted score (D-47)", () => {
  it("fixed fixture of 3 responses -> 61 /100", () => {
    expect(advisorScore(FIXTURE)).toBe(61);
  });

  it("Q8 answers and Q3 are not part of the score", () => {
    const changed = FIXTURE.map((a) => ({ ...a, Q8: 5, Q3: "No" as const }));
    expect(advisorScore(changed)).toBe(61);
  });

  it("all best answers -> 100, all worst -> 0", () => {
    const best: AnswerMap = { Q1: 5, Q2: "Yes", Q4: 5, Q5: "Yes", Q6: "Yes", Q7: "Yes", Q9: "Yes" };
    const worst: AnswerMap = { Q1: 1, Q2: "No", Q4: 1, Q5: "No", Q6: "No", Q7: "No", Q9: "No" };
    expect(advisorScore([best, best, best])).toBe(100);
    expect(advisorScore([worst, worst, worst])).toBe(0);
  });

  it("under 3 responses -> no score", () => {
    expect(advisorScore(FIXTURE.slice(0, 2))).toBeNull();
  });

  it("a question nobody answered does not drag the score down", () => {
    const onlyQ4: AnswerMap[] = [{ Q4: 5 }, { Q4: 5 }, { Q4: 5 }];
    expect(advisorScore(onlyQ4)).toBe(100);
    expect(advisorScore([{}, {}, {}])).toBeNull();
  });

  it("overview advisors: scored advisor first, under-3 advisor shows null score last", () => {
    const rows: Row[] = [
      ...FIXTURE.map((answers) => ({ answers, card: { advisorId: "a1" } })),
      { answers: FIXTURE[0] ?? {}, card: { advisorId: "a2" } },
    ];
    const data = computeOverview(build(rows), F, { a1: "Suresh", a2: "Bala" });
    expect(data.advisors.map((a) => [a.name, a.score, a.responses])).toEqual([
      ["Suresh", 61, 3],
      ["Bala", null, 1],
    ]);
    expect(data.advisors[0]).toMatchObject({ avgBehaviour: 3, avgSatisfaction: 4 });
  });
});

describe("KPI tiles data (F-5)", () => {
  it("Q1 ratings 4, 5, 3 -> average 4; recommend rate from Q9; callbacks from Q10", () => {
    const rows: Row[] = [
      { answers: { Q1: 4, Q9: "Yes", Q10: "Yes" } },
      { answers: { Q1: 5, Q9: "Yes", Q10: "No" } },
      { answers: { Q1: 3, Q9: "No", Q10: "Yes" } },
    ];
    const k = computeOverview(build(rows), F).kpis;
    expect(k.avgSatisfaction.value).toBe(4);
    expect(k.recommendRate.value).toBe(67);
    expect(k.callbacks.value).toBe(2);
  });
});

describe("categories v2", () => {
  const rows: Row[] = [
    {
      answers: {
        Q1: 2,
        Q1a: { options: ["Poor workmanship"] },
        Q2: "Partially",
        Q3: "Yes",
        Q4: 5,
        Q9: "Yes",
        Q9a: "Quality of Service",
      },
    },
    { answers: { Q1: 4, Q2: "No", Q3: "No", Q9: "No" } },
  ];
  const cats = computeOverview(build(rows), F).categoryScores;

  it("steps 1-5 hold exactly the v2 questions", () => {
    expect(cats.map((c) => c.questions.map((q) => q.code))).toEqual([
      ["Q1", "Q2", "Q3"],
      ["Q4"],
      ["Q5", "Q6"],
      ["Q7", "Q8"],
      ["Q9"],
    ]);
  });

  it("follow-up is merged under its parent and counted; no follow-up code is a row of its own", () => {
    const q1 = cats[0]?.questions[0];
    const countOf = (list: { answer: string; count: number }[] | undefined, key: string) =>
      list?.find((a) => a.answer === key)?.count;
    expect(q1?.followUp?.code).toBe("Q1a");
    expect(q1?.followUp?.options.find((o) => o.option === "Poor workmanship")?.count).toBe(1);
    expect(q1?.answers.map((a) => a.answer)).toEqual(["1", "2", "3", "4", "5"]);
    expect(countOf(q1?.answers, "2")).toBe(1);
  });

  it("Q2 lists Yes, Partially and No", () => {
    expect(cats[0]?.questions[1]?.answers.map((a) => a.answer)).toEqual(["Yes", "Partially", "No"]);
  });

  it("Q3 is inverted in the score: Q1 2 (25), Q2 Partially (50), Q3 Yes (0) / Q1 4 (75), Q2 No (0), Q3 No (100) -> mean(25,50,0,75,0,100) = 41.7", () => {
    expect(cats[0]?.score).toBe(41.7);
  });
});

describe("trend v2", () => {
  it("weekly bucket averages Q1 and the Q9 Yes percentage; empty weeks are null", () => {
    const rows: Row[] = [
      { answers: { Q1: 4, Q9: "Yes" }, card: { serviceDate: "2026-03-02" } },
      { answers: { Q1: 5, Q9: "No" }, card: { serviceDate: "2026-03-04" } },
    ];
    const t = computeOverview(build(rows), F).trend;
    expect(t.granularity).toBe("week");
    expect(t.points.find((p) => p.bucketStart === "2026-03-02")).toMatchObject({
      avgSatisfaction: 4.5,
      recommendRate: 50,
    });
    expect(t.points.find((p) => p.bucketStart === "2026-02-23")).toMatchObject({
      avgSatisfaction: null,
      recommendRate: null,
    });
  });

  it("range beyond 90 days -> monthly buckets", () => {
    const rows: Row[] = [{ answers: { Q1: 4 } }];
    const t = computeOverview(build(rows), { from: "2025-12-01", to: "2026-03-10" }).trend;
    expect(t.granularity).toBe("month");
    expect(t.points.map((p) => p.bucketStart)).toEqual([
      "2025-12-01",
      "2026-01-01",
      "2026-02-01",
      "2026-03-01",
    ]);
  });
});
