import type { DataAccess } from "@/data/access";
import type { AnswerMap } from "@/domain/types";
import { clearDraft } from "./draft";

export type SubmitOutcome =
  | { kind: "done"; callbackRequested: boolean }
  | { kind: "already" }
  | { kind: "invalid" }
  | { kind: "expired" }
  | { kind: "failed"; message: string };

export const SAVE_FAILED_MESSAGE = "Couldn't save, try again";

/**
 * Submits the answers. The draft is cleared only on success, so a failed save keeps every answer
 * and Retry (calling this again) can succeed (S-13).
 */
export async function submitFeedback(
  data: Pick<DataAccess, "feedback">,
  token: string,
  visitId: string,
  answers: AnswerMap,
): Promise<SubmitOutcome> {
  const result = await data.feedback.submitResponse(token, answers);
  if (result.ok) {
    clearDraft(visitId);
    return { kind: "done", callbackRequested: result.value.callbackRequested };
  }
  switch (result.error.code) {
    case "ALREADY_COMPLETED":
      clearDraft(visitId);
      return { kind: "already" };
    case "NOT_FOUND":
      return { kind: "invalid" };
    case "CONFLICT":
      return { kind: "expired" };
    default:
      return { kind: "failed", message: SAVE_FAILED_MESSAGE };
  }
}
