import { RECENT_COMMENTS } from "../constants";
import { QUESTIONNAIRE_V2 } from "../questionnaire";
import type { AnalyticsInput, AnswerValue, OverviewData } from "../types";
import { numberOf } from "./stats";

type Comment = OverviewData["comments"][number];
type ResponseRow = AnalyticsInput["responses"][number];

/** Q14 first, then every follow-up that can carry free text. */
const TEXT_CODES = QUESTIONNAIRE_V2.questions
  .filter((q) => q.code === "Q14" || (q.parent !== undefined && q.type !== "single_select"))
  .map((q) => q.code);

function textOf(v: AnswerValue | undefined): string {
  if (typeof v === "string") return v.trim();
  return typeof v === "object" ? (v.text ?? "").trim() : "";
}

function commentsOf(row: ResponseRow): Comment[] {
  const q12 = numberOf(row.response.answers, "Q12");
  if (q12 === null) return [];
  return TEXT_CODES.flatMap((source) => {
    const text = textOf(row.response.answers[source]);
    if (text === "") return [];
    const serviceDate = row.jobCard.serviceDate;
    return [{ responseId: row.response.id, serviceDate, source, text, q12 }];
  });
}

/** Newest RECENT_COMMENTS free-text answers (Q14 + follow-up text) with the Q12 rating; text stays raw. */
export function buildComments(rows: ResponseRow[]): Comment[] {
  return [...rows]
    .sort((a, b) => b.response.submittedAt.localeCompare(a.response.submittedAt))
    .flatMap(commentsOf)
    .slice(0, RECENT_COMMENTS);
}
