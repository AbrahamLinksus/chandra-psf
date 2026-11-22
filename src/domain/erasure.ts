import type { AnswerMap, AnswerValue } from "./types";

const FREE_TEXT_CODES = new Set<string>(["Q14", "Q2a", "Q13a"]);

function withoutText(v: AnswerValue): AnswerValue {
  return typeof v === "object" ? { options: v.options } : v;
}

/** Answers with all free text removed (US-30, US-31): drops Q14, Q2a, Q13a and every `.text`; keeps ratings and chips. */
export function stripFreeText(answers: AnswerMap): AnswerMap {
  const out: AnswerMap = {};
  for (const [code, value] of Object.entries(answers) as [keyof AnswerMap, AnswerValue][]) {
    if (!FREE_TEXT_CODES.has(code)) out[code] = withoutText(value);
  }
  return out;
}
