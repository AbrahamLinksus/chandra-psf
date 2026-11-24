import type { Questionnaire } from "@/domain/questionnaire";
import type { AnswerMap, ISODate } from "@/domain/types";
import type { Result } from "../result";

export type FormContext =
  | {
      state: "ready";
      visitId: string;
      customerName: string;
      model: string;
      regNo: string;
      serviceDate: ISODate;
      questionnaire: Questionnaire;
    }
  | { state: "expired"; replaced: boolean }
  | { state: "completed" }
  | { state: "invalid" }
  /** More than 30 opens of this link in an hour. */
  | { state: "rate_limited" };

export interface FeedbackRepo {
  getVisitByToken(token: string): Promise<Result<FormContext>>;
  /** sets openedAt once; always ok (an unknown or finished link is a silent no-op) */
  markOpened(token: string): Promise<Result<void>>;
  /**
   * VALIDATION (fields = missing question codes), ALREADY_COMPLETED, NOT_FOUND, CONFLICT (link expired),
   * RATE_LIMITED (6th try in an hour), SAVE_FAILED.
   * `submissionId` is a UUID kept in the draft: a retry with the same id after success returns the same result (G-15).
   * When omitted, the server makes one up (no retry protection).
   */
  submitResponse(
    token: string,
    answers: AnswerMap,
    submissionId?: string,
  ): Promise<Result<{ callbackRequested: boolean }>>;
}
