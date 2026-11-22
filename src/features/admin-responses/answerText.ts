import type { AnswerValue } from "@/domain/types";

/** Plain-text form of one answer (never HTML). */
export function answerText(v: AnswerValue | undefined): string {
  if (v === undefined) return "—";
  if (typeof v === "number") return `${String(v)} / 5`;
  if (typeof v === "string") return v;
  const text = v.text?.trim() ?? "";
  return [v.options.join(", "), text].filter((s) => s !== "").join(" — ");
}
