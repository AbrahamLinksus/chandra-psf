import type { AnswerMap, AnswerValue, QuestionCode } from "./types";

/** Flat storage row (phase 2: value_num / value_text / value_options). */
export interface AnswerRow {
  code: QuestionCode;
  valueNum: number | null;
  valueText: string | null;
  valueOptions: string[] | null;
}

function toRow(code: QuestionCode, v: AnswerValue): AnswerRow {
  if (typeof v === "number") return { code, valueNum: v, valueText: null, valueOptions: null };
  if (typeof v === "string") return { code, valueNum: null, valueText: v, valueOptions: null };
  return { code, valueNum: null, valueText: v.text ?? null, valueOptions: v.options };
}

export function toAnswerRows(map: AnswerMap): AnswerRow[] {
  return (Object.entries(map) as [QuestionCode, AnswerValue][]).map(([code, v]) => toRow(code, v));
}

function fromRow(r: AnswerRow): AnswerValue | undefined {
  if (r.valueOptions !== null) {
    return r.valueText === null
      ? { options: r.valueOptions }
      : { options: r.valueOptions, text: r.valueText };
  }
  if (r.valueNum !== null) return r.valueNum;
  return r.valueText ?? undefined;
}

export function fromAnswerRows(rows: AnswerRow[]): AnswerMap {
  const map: AnswerMap = {};
  for (const r of rows) {
    const v = fromRow(r);
    if (v !== undefined) map[r.code] = v;
  }
  return map;
}
