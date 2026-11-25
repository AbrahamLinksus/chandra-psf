import type { AnalyticsInput, AnswerMap, Filters, Metric, OverviewData } from "../types";
import { buildAdvisors } from "./advisors";
import { buildCategories } from "./categories";
import { matches, previousPeriod } from "./filters";
import { avgRating, delta, yesPercent } from "./stats";
import { buildTrend } from "./trend";

type ResponseRow = AnalyticsInput["responses"][number];

function metric(value: number | null, previous: number | null): Metric {
  return { value, previous, delta: delta(value, previous) };
}

function inScope(input: AnalyticsInput, f: Filters): ResponseRow[] {
  return input.responses.filter((r) => matches(r.jobCard, f));
}

/** Completed / eligible visits in scope; cancelled and replaced visits are left out (S-14). A
 * visit counts as completed only while it still has a live response (S-09). Null with no visits. */
function responseRate(input: AnalyticsInput, f: Filters): number | null {
  const answered = new Set(input.responses.map((r) => r.visit.id));
  const eligible = input.visits.filter(
    (v) => matches(v.jobCard, f) && v.visit.cancelledAt === null && v.visit.replacedBy === null,
  );
  if (eligible.length === 0) return null;
  const done = eligible.filter((v) => v.visit.completedAt !== null && answered.has(v.visit.id));
  return Math.round((done.length / eligible.length) * 100);
}

/** Responses with Q10 = Yes; null with no responses (shown as "—"). */
function callbacks(rows: ResponseRow[]): number | null {
  if (rows.length === 0) return null;
  return rows.filter((r) => r.response.answers.Q10 === "Yes").length;
}

function kpisFor(input: AnalyticsInput, f: Filters): Omit<OverviewData["kpis"], "openAlerts"> {
  const prevFilters = previousPeriod(f);
  const now = inScope(input, f);
  const prev = inScope(input, prevFilters);
  const answers = (rows: ResponseRow[]): AnswerMap[] => rows.map((r) => r.response.answers);
  const count = (rows: ResponseRow[]): number | null => (rows.length === 0 ? null : rows.length);
  return {
    responses: metric(count(now), count(prev)),
    responseRate: metric(responseRate(input, f), responseRate(input, prevFilters)),
    avgSatisfaction: metric(avgRating(answers(now), "Q1"), avgRating(answers(prev), "Q1")),
    recommendRate: metric(yesPercent(answers(now), "Q9"), yesPercent(answers(prev), "Q9")),
    callbacks: metric(callbacks(now), callbacks(prev)),
  };
}

/**
 * Every Overview block for one filter set (LLD 1.4). `advisorNames` / `advisorBranches` map
 * advisor ids to display names and branch names (the input carries ids only); an unknown id falls
 * back to the id / no branch.
 */
export function computeOverview(
  input: AnalyticsInput,
  f: Filters,
  advisorNames: Record<string, string> = {},
  advisorBranches: Record<string, string> = {},
): OverviewData {
  const rows = inScope(input, f);
  return {
    kpis: { ...kpisFor(input, f), openAlerts: input.openAlerts },
    categoryScores: buildCategories(rows.map((r) => r.response.answers)),
    trend: buildTrend(
      rows.map((r) => ({ serviceDate: r.jobCard.serviceDate, answers: r.response.answers })),
      f,
    ),
    advisors: buildAdvisors(
      rows.map((r) => ({ advisorId: r.jobCard.advisorId, answers: r.response.answers })),
      advisorNames,
      advisorBranches,
    ),
  };
}
