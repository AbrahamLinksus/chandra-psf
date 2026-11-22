import type { Question } from "@/domain/questionnaire";
import type { AnswerValue } from "@/domain/types";

export interface FieldProps {
  question: Question;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
}

export const RATING_FACES: { value: number; face: string; label: string }[] = [
  { value: 1, face: "😡", label: "Very poor" },
  { value: 2, face: "🙁", label: "Poor" },
  { value: 3, face: "😐", label: "Okay" },
  { value: 4, face: "🙂", label: "Good" },
  { value: 5, face: "😍", label: "Excellent" },
];

/** Chip options for a single-choice question. */
export function choiceOptions(q: Question): string[] {
  if (q.type === "yes_no") return ["Yes", "No"];
  if (q.type === "yes_partial_no") return ["Yes", "Partially", "No"];
  return q.options ?? [];
}
