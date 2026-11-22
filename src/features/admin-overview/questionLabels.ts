import { QUESTIONNAIRE_V1 } from "@/domain/questionnaire";
import type { QuestionCode } from "@/domain/types";

/** Question wording from the questionnaire config; the code itself when unknown. */
export function questionText(code: QuestionCode): string {
  return QUESTIONNAIRE_V1.questions.find((q) => q.code === code)?.text ?? code;
}
