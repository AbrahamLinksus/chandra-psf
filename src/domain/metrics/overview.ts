import { QUESTIONNAIRE_V2 } from "../questionnaire";
import type { AnalyticsInput, AnswerMap, Filters, Metric, OverviewData } from "../types";
import { buildProblems, buildQuestionDetail } from "./breakdowns";
import { buildComments } from "./comments";
import { matches, previousPeriod } from "./filters";
import { mean, stepScores } from "./scores";
import { avgRating, delta, round1, yesPercent } from "./stats";
import { buildTrend } from "./trend";

type ResponseRow = AnalyticsInput["responses"][number];
type Advisors = OverviewData["advisors"];
const CATEGORY_STEPS = [1, 2, 3, 4, 5];

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

function kpisFor(input: AnalyticsInput, f: Filters): Omit<OverviewData["kpis"], "openAlerts"> {
  const prevFilters = previousPeriod(f);
  const now = inScope(input, f);
  const prev = inScope(input, prevFilters);
  const answers = (rows: ResponseRow[]): AnswerMap[] => rows.map((r) => r.response.answers);
  const count = (rows: ResponseRow[]): number | null => (rows.length === 0 ? null : rows.length);
  return {
    responses: metric(count(now), count(prev)),
    responseRate: metric(responseRate(input, f), responseRate(input, prevFilters)),
    avgQ12: metric(avgRating(answers(now), "Q12"), avgRating(answers(prev), "Q12")),
    recommendRate: metric(yesPercent(answers(now), "Q13"), yesPercent(answers(prev), "Q13")),
  };
}

function categoryScores(list: AnswerMap[]): OverviewData["categoryScores"] {
  return CATEGORY_STEPS.map((step) => {
    const score = mean(list.flatMap((a) => stepScores(step, a)));
    const title = QUESTIONNAIRE_V2.steps.find((s) => s.n === step)?.title ?? `Step ${String(step)}`;
    return { step, title, score: score === null ? null : round1(score) };
  });
}

function advisorRows(rows: ResponseRow[], names: Record<string, string>): Advisors {
  const groups = new Map<string, AnswerMap[]>();
  for (const r of rows) {
    const id = r.jobCard.advisorId;
    groups.set(id, [...(groups.get(id) ?? []), r.response.answers]);
  }
  return [...groups.entries()]
    .map(([advisorId, list]) => ({
      advisorId,
      name: names[advisorId] ?? advisorId,
      responses: list.length,
      avgQ6: avgRating(list, "Q6"),
      q4Yes: yesPercent(list, "Q4"),
      q7Yes: yesPercent(list, "Q7"),
      avgQ12: avgRating(list, "Q12"),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Every Overview block for one filter set (LLD 1.4). `advisorNames` maps advisor ids to display
 * names (the input carries ids only); an unknown id falls back to the id.
 */
export function computeOverview(
  input: AnalyticsInput,
  f: Filters,
  advisorNames: Record<string, string> = {},
): OverviewData {
  const rows = inScope(input, f);
  const list = rows.map((r) => r.response.answers);
  return {
    kpis: { ...kpisFor(input, f), openAlerts: input.openAlerts },
    categoryScores: categoryScores(list),
    trend: buildTrend(
      rows.map((r) => ({ serviceDate: r.jobCard.serviceDate, answers: r.response.answers })),
      f,
    ),
    advisors: advisorRows(rows, advisorNames),
    problems: buildProblems(list),
    questionDetail: buildQuestionDetail(list),
    comments: buildComments(rows),
  };
}
