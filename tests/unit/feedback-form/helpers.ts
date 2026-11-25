import type { AnswerMap } from "@/domain/types";

/** A complete, valid set of v2 answers (all happy, no callback). */
export function happyAnswers(extra: AnswerMap = {}): AnswerMap {
  return {
    Q1: 5,
    Q2: "Yes",
    Q3: "No",
    Q4: 5,
    Q5: "Yes",
    Q6: "Yes",
    Q7: "Yes",
    Q8: 5,
    Q9: "Yes",
    Q9a: "Quality of Service",
    Q10: "No",
    ...extra,
  };
}
