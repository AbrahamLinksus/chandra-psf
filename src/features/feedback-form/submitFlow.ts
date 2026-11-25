import type { DataAccess, ErrorCode } from "@/data/access";
import type { AnswerMap } from "@/domain/types";
import { clearDraft } from "./draft";

export type SubmitOutcome =
  | { kind: "done"; callbackRequested: boolean; callbackSlot?: string }
  | { kind: "already" }
  | { kind: "invalid" }
  | { kind: "expired" }
  | { kind: "failed"; message: string; code?: ErrorCode };

export const SAVE_FAILED_MESSAGE = "Couldn't save, try again";

/**
 * Submits the answers. The draft is cleared only on success, so a failed save keeps every answer
 * and Retry (calling this again with the same submission id) can succeed (S-13, G-15).
 */
export async function submitFeedback(
  data: Pick<DataAccess, "feedback">,
  token: string,
  visitId: string,
  answers: AnswerMap,
  submissionId?: string,
): Promise<SubmitOutcome> {
  const result = await data.feedback.submitResponse(token, answers, submissionId);
  if (result.ok) {
    clearDraft(visitId);
    const { callbackRequested, callbackSlot } = result.value;
    return callbackSlot === undefined
      ? { kind: "done", callbackRequested }
      : { kind: "done", callbackRequested, callbackSlot };
  }
  switch (result.error.code) {
    case "ALREADY_COMPLETED":
      clearDraft(visitId);
      return { kind: "already" };
    case "NOT_FOUND":
      return { kind: "invalid" };
    case "CONFLICT":
      return { kind: "expired" };
    case "RATE_LIMITED":
      return { kind: "failed", message: result.error.message, code: "RATE_LIMITED" };
    default:
      return { kind: "failed", message: SAVE_FAILED_MESSAGE };
  }
}
