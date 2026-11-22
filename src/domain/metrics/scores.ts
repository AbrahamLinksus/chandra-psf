import { QUESTIONNAIRE_V1, type Question } from "../questionnaire";
import type { AnswerMap, AnswerValue } from "../types";

/** Rating 1-5 to 0-100: (rating - 1) / 4 * 100. */
export function ratingScore(rating: number): number {
  return ((rating - 1) / 4) * 100;
}

/** Yes/No(/Partially) to 100/0(/50). Q3 ("any issue after delivery?") is reversed. Unknown gives null. */
export function yesNoScore(code: string, v: AnswerValue | undefined): number | null {
  if (v !== "Yes" && v !== "No" && v !== "Partially") return null;
  if (v === "Partially") return code === "Q2" ? 50 : null;
  const good = code === "Q3" ? v === "No" : v === "Yes";
  return good ? 100 : 0;
}

function questionScore(q: Question, v: AnswerValue | undefined): number | null {
  if (q.type === "rating_5") return typeof v === "number" ? ratingScore(v) : null;
  if (q.type === "yes_no" || q.type === "yes_partial_no") return yesNoScore(q.code, v);
  return null;
}

/** Scores of the answered scoreable questions of one step (follow-ups and text are never scored). */
export function stepScores(step: number, answers: AnswerMap): number[] {
  return QUESTIONNAIRE_V1.questions
    .filter((q) => q.step === step && q.parent === undefined)
    .flatMap((q) => questionScore(q, answers[q.code]) ?? []);
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Category score = mean of the step's question scores, or null when none are answered. */
export function categoryScore(step: number, answers: AnswerMap): number | null {
  return mean(stepScores(step, answers));
}
