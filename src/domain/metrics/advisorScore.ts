import type { AnswerMap, QuestionCode } from "../types";
import { mean, ratingScore, yesNoScore } from "./scores";

/** Fewer responses than this and an advisor gets no score (D-47). */
export const ADVISOR_MIN_RESPONSES = 3;

/** D-47 weights (sum 100): behaviour Q4, overall Q1, complaints Q2, charges Q7, on time Q5, condition Q6, recommend Q9. */
export const ADVISOR_WEIGHTS: Readonly<Partial<Record<QuestionCode, number>>> = {
  Q4: 30,
  Q1: 20,
  Q2: 15,
  Q7: 10,
  Q5: 10,
  Q6: 10,
  Q9: 5,
};

const RATING_CODES: QuestionCode[] = ["Q1", "Q4"];

function answerScore(code: QuestionCode, a: AnswerMap): number | null {
  const v = a[code];
  if (RATING_CODES.includes(code)) return typeof v === "number" ? ratingScore(v) : null;
  return yesNoScore(code, v);
}

/**
 * Weighted advisor score /100 as a whole number, or null under ADVISOR_MIN_RESPONSES responses.
 * Each weighted question is averaged over the responses that answered it; the weighted mean is
 * re-normalised over the questions with at least one answer (a question nobody answered does not
 * drag the score down). Null when no weighted question was answered at all.
 */
export function advisorScore(list: AnswerMap[]): number | null {
  if (list.length < ADVISOR_MIN_RESPONSES) return null;
  let total = 0;
  let weights = 0;
  for (const [code, weight] of Object.entries(ADVISOR_WEIGHTS) as [QuestionCode, number][]) {
    const avg = mean(list.flatMap((a) => answerScore(code, a) ?? []));
    if (avg === null) continue;
    total += avg * weight;
    weights += weight;
  }
  return weights === 0 ? null : Math.round(total / weights);
}
