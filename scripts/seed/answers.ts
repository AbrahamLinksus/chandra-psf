/** xlsx rows -> questionnaire answers (SPEC 6 seed rules). */
import ExcelJS from "exceljs";
import type { AnswerMap, AnswerValue, QuestionCode } from "../../src/domain/types";

export interface SurveyRow {
  sampleId: string;
  customer: string;
  answers: AnswerMap;
}

const CALLBACK_YES = new Set(["CUST-006", "CUST-014", "CUST-022"]);

/** Plain text of an exceljs cell value (the sheet only holds numbers and strings). */
function cellText(v: ExcelJS.CellValue): string {
  return typeof v === "string" || typeof v === "number" ? String(v) : "";
}

export function extra(
  sampleId: string,
  customer: string,
  values: AnswerValue[],
  q14: string,
): SurveyRow {
  const answers: AnswerMap = { Q14: q14 };
  values.forEach((value, i) => {
    answers[`Q${String(i + 1)}` as QuestionCode] = value;
  });
  return { sampleId, customer, answers };
}

function questionColumns(ws: ExcelJS.Worksheet): Map<number, QuestionCode> {
  const columns = new Map<number, QuestionCode>();
  ws.getRow(1).eachCell((cell, col) => {
    const m = /^Q(\d+)\./.exec(cellText(cell.value));
    if (m !== null) columns.set(col, `Q${m[1] ?? ""}` as QuestionCode);
  });
  return columns;
}

export async function readSurveyRows(file: string): Promise<SurveyRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.worksheets[0];
  if (ws === undefined) throw new Error("The workbook has no sheets");
  const columns = questionColumns(ws);
  const rows: SurveyRow[] = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const answers: AnswerMap = {};
    for (const [col, code] of columns) answers[code] = row.getCell(col).value as AnswerValue;
    rows.push({
      sampleId: cellText(row.getCell(1).value),
      customer: cellText(row.getCell(2).value),
      answers,
    });
  });
  return rows;
}

const low = (v: AnswerValue | undefined): boolean => typeof v === "number" && v <= 3;
const text = (v: AnswerValue | undefined): string => (typeof v === "string" ? v : "");
const choice = (option: string, note: string): AnswerValue =>
  option === "Other" ? { options: [option], text: note } : { options: [option] };

interface FollowUp {
  code: QuestionCode;
  when: (a: AnswerMap) => boolean;
  value: (a: AnswerMap, note: string) => AnswerValue;
}

const Q1A: Record<string, string> = {
  No: "Problem not fixed",
  Partially: "Same problem came back",
};

/** One rule per follow-up question; hints come from the answers and the Q14 comment. */
const FOLLOW_UPS: FollowUp[] = [
  {
    code: "Q1a",
    when: (a) => low(a.Q1),
    value: (a, note) =>
      choice(Q1A[text(a.Q2)] ?? (a.Q3 === "Yes" ? "New problem appeared" : "Other"), note),
  },
  {
    code: "Q2a",
    when: (a) => a.Q2 !== "Yes",
    value: (a) =>
      a.Q2 === "No" ? "The main complaint was not fixed." : "One complaint was only partly fixed.",
  },
  {
    code: "Q3a",
    when: (a) => a.Q3 === "Yes",
    value: (a, note) =>
      choice(a.Q9 === "No" ? "Body & paint" : a.Q2 === "Yes" ? "Other" : "Engine", note),
  },
  {
    code: "Q6a",
    when: (a) => low(a.Q6),
    value: (a, note) =>
      choice(a.Q6 === 1 ? "Rude" : a.Q4 === "No" ? "Didn't answer queries" : "Not attentive", note),
  },
  {
    code: "Q7a",
    when: (a) => a.Q7 === "No",
    value: (_a, note) => (/later|delivery time/i.test(note) ? "2+ days late" : "1 day late"),
  },
  {
    code: "Q9a",
    when: (a) => a.Q9 === "No",
    value: (a, note) => choice(a.Q8 === "No" ? "Dirty" : "Other", note),
  },
  {
    code: "Q11a",
    when: (a) => low(a.Q11),
    value: (a, note) => choice(a.Q10 === "No" ? "Extra work not agreed" : "Parts", note),
  },
  { code: "Q13a", when: (a) => a.Q13 === "No", value: (_a, note) => note },
];

/** Q11 1-10 -> ceil(x/2); Q15 No unless a listed unhappy row; follow-ups for negative answers. */
export function toAnswers(row: SurveyRow): AnswerMap {
  const a: AnswerMap = { ...row.answers };
  if (typeof a.Q11 === "number") a.Q11 = Math.ceil(a.Q11 / 2);
  a.Q15 = CALLBACK_YES.has(row.sampleId) ? "Yes" : "No";
  const note = text(a.Q14);
  for (const rule of FOLLOW_UPS) if (rule.when(a)) a[rule.code] = rule.value(a, note);
  return a;
}
