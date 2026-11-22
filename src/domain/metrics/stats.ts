import type { AnswerMap, QuestionCode } from "../types";
import { mean } from "./scores";

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function numberOf(answers: AnswerMap, code: QuestionCode): number | null {
  const v = answers[code];
  return typeof v === "number" ? v : null;
}

/** Mean of a rating question over answer maps, one decimal, or null with no answers. */
export function avgRating(list: AnswerMap[], code: QuestionCode): number | null {
  const m = mean(list.flatMap((a) => numberOf(a, code) ?? []));
  return m === null ? null : round1(m);
}

/** Whole-number % of "Yes" among the answered; null with no answers (never 0/0). */
export function yesPercent(list: AnswerMap[], code: QuestionCode): number | null {
  const answered = list.map((a) => a[code]).filter((v) => v === "Yes" || v === "No");
  if (answered.length === 0) return null;
  return Math.round((answered.filter((v) => v === "Yes").length / answered.length) * 100);
}

/** Change vs previous; null (arrow hidden) unless both periods have data. */
export function delta(value: number | null, previous: number | null): number | null {
  return value === null || previous === null ? null : round1(value - previous);
}
