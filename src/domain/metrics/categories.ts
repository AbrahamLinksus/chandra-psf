import { QUESTIONNAIRE_V2, type Question } from "../questionnaire";
import type { AnswerMap, AnswerValue, CategoryQuestion, OverviewData } from "../types";
import { mean, stepScores } from "./scores";
import { round1 } from "./stats";

type Categories = OverviewData["categoryScores"];
const CATEGORY_STEPS = [1, 2, 3, 4, 5];
const RATINGS = ["1", "2", "3", "4", "5"];

function chosen(v: AnswerValue | undefined): string[] {
  if (typeof v === "string") return [v];
  if (typeof v === "number") return [String(v)];
  return typeof v === "object" ? v.options : [];
}

function answerChoices(q: Question): string[] {
  if (q.type === "rating_5") return RATINGS;
  return q.type === "yes_no" ? ["Yes", "No"] : ["Yes", "Partially", "No"];
}

function countOf(list: AnswerMap[], code: Question["code"], option: string): number {
  return list.filter((a) => chosen(a[code]).includes(option)).length;
}

function followUpOf(q: Question, list: AnswerMap[]): CategoryQuestion["followUp"] {
  const f = QUESTIONNAIRE_V2.questions.find((x) => x.parent === q.code && x.options !== undefined);
  if (f === undefined) return null;
  const options = (f.options ?? []).map((option) => ({
    option,
    count: countOf(list, f.code, option),
  }));
  return { code: f.code, text: f.text, options };
}

function questionRow(q: Question, list: AnswerMap[]): CategoryQuestion {
  return {
    code: q.code,
    text: q.text,
    answers: answerChoices(q).map((answer) => ({ answer, count: countOf(list, q.code, answer) })),
    followUp: followUpOf(q, list),
  };
}

/** Steps 1-5 with score /100 and, when there are responses, their questions with answer bars. */
export function buildCategories(list: AnswerMap[]): Categories {
  return CATEGORY_STEPS.map((step) => {
    const score = mean(list.flatMap((a) => stepScores(step, a)));
    const title = QUESTIONNAIRE_V2.steps.find((s) => s.n === step)?.title ?? `Step ${String(step)}`;
    const questions = QUESTIONNAIRE_V2.questions.filter(
      (q) => q.step === step && q.parent === undefined,
    );
    return {
      step,
      title,
      score: score === null ? null : round1(score),
      questions: list.length === 0 ? [] : questions.map((q) => questionRow(q, list)),
    };
  });
}
