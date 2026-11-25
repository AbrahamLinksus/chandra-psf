import type { AnswerMap, OverviewData } from "../types";
import { advisorScore } from "./advisorScore";
import { avgRating, yesPercent } from "./stats";

type Advisors = OverviewData["advisors"];

export interface AdvisorRowInput {
  advisorId: string;
  answers: AnswerMap;
}

/** One row per advisor with responses; score high to low, unscored last, then by name. */
export function buildAdvisors(
  rows: AdvisorRowInput[],
  names: Record<string, string>,
  branchNames: Record<string, string>,
): Advisors {
  const groups = new Map<string, AnswerMap[]>();
  for (const r of rows) groups.set(r.advisorId, [...(groups.get(r.advisorId) ?? []), r.answers]);
  return [...groups.entries()]
    .map(([advisorId, list]) => ({
      advisorId,
      name: names[advisorId] ?? advisorId,
      branchName: branchNames[advisorId] ?? null,
      responses: list.length,
      score: advisorScore(list),
      avgBehaviour: avgRating(list, "Q4"),
      onTimePercent: yesPercent(list, "Q5"),
      avgSatisfaction: avgRating(list, "Q1"),
    }))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.name.localeCompare(b.name));
}
