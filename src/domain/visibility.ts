import { TEXT_MAX_LENGTH } from "./constants";
import { findQuestion, QUESTIONNAIRE_V2, type Question, type ShowIf } from "./questionnaire";
import type { AnswerMap, AnswerValue, QuestionCode } from "./types";

function matches(rule: ShowIf, value: AnswerValue | undefined): boolean {
  if (value === undefined) return false;
  switch (rule.op) {
    case "lte":
      return typeof value === "number" && value <= rule.value;
    case "gte":
      return typeof value === "number" && value >= rule.value;
    case "eq":
      return value === rule.value;
    case "in":
      return typeof value === "string" && rule.value.includes(value);
  }
}

/** A question is visible when it has no parent, or its parent is visible and the trigger matches. */
export function isVisible(q: Question, answers: AnswerMap): boolean {
  if (q.parent === undefined || q.showIf === undefined) return true;
  const parent = findQuestion(q.parent);
  if (parent === undefined || !isVisible(parent, answers)) return false;
  return matches(q.showIf, answers[q.parent]);
}

export function visibleQuestions(step: number, answers: AnswerMap): Question[] {
  return QUESTIONNAIRE_V2.questions.filter((q) => q.step === step && isVisible(q, answers));
}

function isRating(v: AnswerValue | undefined): boolean {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5;
}

function isChoice(v: AnswerValue | undefined, options: string[]): boolean {
  return typeof v === "string" && options.includes(v);
}

function textOk(q: Question, text: string): boolean {
  return text.length <= (q.maxLength ?? TEXT_MAX_LENGTH);
}

function multiOk(q: Question, v: AnswerValue | undefined): boolean {
  if (typeof v !== "object") return false;
  const allowed = q.options ?? [];
  if (v.options.some((o) => !allowed.includes(o))) return false;
  if (q.required && v.options.length === 0) return false;
  const text = v.text ?? "";
  if (q.textRequired === true && text.trim() === "") return false;
  return textOk(q, text);
}

function textAnswerOk(q: Question, v: AnswerValue | undefined): boolean {
  if (v === undefined) return !q.required;
  return typeof v === "string" && textOk(q, v) && (!q.required || v.trim() !== "");
}

/** True when the answer is present and valid for the question's type (a missing optional text is fine). */
export function isAnswered(q: Question, v: AnswerValue | undefined): boolean {
  switch (q.type) {
    case "rating_5":
      return isRating(v);
    case "yes_no":
      return isChoice(v, ["Yes", "No"]);
    case "yes_partial_no":
      return isChoice(v, ["Yes", "Partially", "No"]);
    case "single_select":
      return isChoice(v, q.options ?? []);
    case "multi_select_text":
      return multiOk(q, v);
    case "text":
      return textAnswerOk(q, v);
  }
}

function stepMissing(step: number, answers: AnswerMap): QuestionCode[] {
  return visibleQuestions(step, answers)
    .filter((q) => !isAnswered(q, answers[q.code]))
    .map((q) => q.code);
}

export function isStepComplete(step: number, answers: AnswerMap): boolean {
  return stepMissing(step, answers).length === 0;
}

/** Drops answers of hidden follow-ups (and unknown codes). */
export function pruneHidden(answers: AnswerMap): AnswerMap {
  const out: AnswerMap = {};
  for (const q of QUESTIONNAIRE_V2.questions) {
    const v = answers[q.code];
    if (v !== undefined && isVisible(q, answers)) out[q.code] = v;
  }
  return out;
}

/** Codes present in a submission that are unknown (e.g. v1 codes) or hidden by their parent's answer. */
export function findStrayAnswers(answers: AnswerMap): QuestionCode[] {
  const known = new Map(QUESTIONNAIRE_V2.questions.map((q) => [q.code, q]));
  return (Object.keys(answers) as QuestionCode[]).filter((code) => {
    const q = known.get(code);
    return q === undefined || !isVisible(q, answers);
  });
}

export function validateSubmission(
  answers: AnswerMap,
): { ok: true; answers: AnswerMap } | { ok: false; missing: QuestionCode[] } {
  const pruned = pruneHidden(answers);
  const missing = QUESTIONNAIRE_V2.steps.flatMap((s) => stepMissing(s.n, pruned));
  return missing.length === 0 ? { ok: true, answers: pruned } : { ok: false, missing };
}
