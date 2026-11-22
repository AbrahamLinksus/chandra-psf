import { QUESTIONNAIRE_V1, findQuestion } from "../questionnaire";
import type { AnswerMap, AnswerValue, OverviewData } from "../types";

type Problems = OverviewData["problems"];
const PROBLEM_CODES = ["Q1a", "Q3a", "Q6a", "Q7a", "Q9a", "Q11a"] as const;

function chosenOptions(v: AnswerValue | undefined): string[] {
  if (typeof v === "string") return [v];
  return typeof v === "object" ? v.options : [];
}

/** Counts per follow-up option (every configured option is listed); empty when there are no responses. */
export function buildProblems(list: AnswerMap[]): Problems {
  const out = {} as Problems;
  for (const code of PROBLEM_CODES) {
    const configured = findQuestion(code)?.options ?? [];
    const counts = configured.map((option) => ({
      option,
      count: list.filter((a) => chosenOptions(a[code]).includes(option)).length,
    }));
    out[code] = list.length === 0 ? [] : counts.sort((a, b) => b.count - a.count);
  }
  return out;
}

/** Yes / Partially / No split for every yes-no style question (Q2-Q5, Q7-Q10, Q13, Q15). */
export function buildQuestionDetail(list: AnswerMap[]): OverviewData["questionDetail"] {
  if (list.length === 0) return [];
  return QUESTIONNAIRE_V1.questions
    .filter((q) => q.type === "yes_no" || q.type === "yes_partial_no")
    .map((q) => {
      const answers = q.type === "yes_no" ? ["Yes", "No"] : ["Yes", "Partially", "No"];
      return {
        code: q.code,
        split: answers.map((answer) => ({
          answer,
          count: list.filter((a) => a[q.code] === answer).length,
        })),
      };
    });
}
