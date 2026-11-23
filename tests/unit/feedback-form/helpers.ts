import type { AnswerMap } from "@/domain/types";

/** A complete, valid set of answers (all happy). */
export function happyAnswers(extra: AnswerMap = {}): AnswerMap {
  return {
    Q1: 5,
    Q2: "Yes",
    Q3: "No",
    Q4: "Yes",
    Q5: "Yes",
    Q6: 5,
    Q7: "Yes",
    Q8: "Yes",
    Q9: "Yes",
    Q10: "Yes",
    Q11: 5,
    Q12: 5,
    Q13: "Yes",
    Q15: "No",
    ...extra,
  };
}
