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
  | { state: "invalid" };

export interface FeedbackRepo {
  getVisitByToken(token: string): Promise<Result<FormContext>>;
  /** sets openedAt once */
  markOpened(token: string): Promise<Result<void>>;
  /** VALIDATION, ALREADY_COMPLETED, NOT_FOUND, CONFLICT (link expired) */
  submitResponse(token: string, answers: AnswerMap): Promise<Result<{ callbackRequested: boolean }>>;
}
