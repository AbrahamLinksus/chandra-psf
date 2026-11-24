"use client";

import { useCallback, useEffect, useReducer, useState, type Dispatch } from "react";
import { err, ok, type DataAccess, type RepoError, type Result } from "@/data/access";
import { useDataAccess } from "@/data/access/provider";
import { useRepoMutation } from "@/hooks/useRepoMutation";
import type { AnswerMap, AnswerValue, QuestionCode } from "@/domain/types";
import { loadDraft, saveDraft, submissionIdFor } from "./draft";
import {
  canGoNext,
  formReducer,
  initialState,
  isLastStep,
  type FormAction,
  type FormState,
} from "./formMachine";
import { submitFeedback, type SubmitOutcome } from "./submitFlow";

export type SubmitStatus = "idle" | "saving" | "error";
export type FlowEnd = "invalid" | "already" | "expired" | null;

export interface FeedbackFlow {
  state: FormState;
  nextEnabled: boolean;
  lastStep: boolean;
  submitStatus: SubmitStatus;
  submitError: RepoError | undefined;
  /** set when the link turned out to be unusable while submitting */
  ended: FlowEnd;
  start: () => void;
  answer: (code: QuestionCode, value: AnswerValue) => void;
  back: () => void;
  next: () => void;
  submit: () => void;
}

interface SubmitIds {
  token: string;
  visitId: string;
}

function useSubmit(ids: SubmitIds, answers: AnswerMap, dispatch: Dispatch<FormAction>) {
  const [ended, setEnded] = useState<FlowEnd>(null);
  const { token, visitId } = ids;
  const send = useCallback(
    async (da: DataAccess, input: AnswerMap): Promise<Result<SubmitOutcome>> => {
      const outcome = await submitFeedback(da, token, visitId, input, submissionIdFor(visitId));
      return outcome.kind === "failed"
        ? err(outcome.code ?? "SAVE_FAILED", outcome.message)
        : ok(outcome);
    },
    [token, visitId],
  );
  const mutation = useRepoMutation(send);
  // a closure from useCallback, not a method that reads `this`
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const { run } = mutation;

  const submit = useCallback(() => {
    void run(answers).then((result) => {
      if (!result.ok) return;
      const outcome = result.value;
      if (outcome.kind === "done") {
        dispatch({ type: "submitted", callbackRequested: outcome.callbackRequested });
      } else if (outcome.kind !== "failed") {
        setEnded(outcome.kind);
      }
    });
  }, [run, answers, dispatch]);
  const status: SubmitStatus =
    mutation.status === "saving" || mutation.status === "error" ? mutation.status : "idle";
  return { status, error: mutation.error, ended, submit };
}

/** Drives the form: reducer, browser draft, "opened" marker and the submit with retry. */
export function useFeedbackFlow(token: string, visitId: string): FeedbackFlow {
  const data = useDataAccess();
  const [state, dispatch] = useReducer(formReducer, visitId, (id) => initialState(loadDraft(id)));
  const { status, error, ended, submit } = useSubmit({ token, visitId }, state.answers, dispatch);

  useEffect(() => {
    void data.feedback.markOpened(token);
  }, [data, token]);

  useEffect(() => {
    if (state.phase === "step") saveDraft(visitId, { step: state.step, answers: state.answers });
  }, [visitId, state.phase, state.step, state.answers]);

  return {
    state,
    nextEnabled: canGoNext(state),
    lastStep: isLastStep(state),
    submitStatus: status,
    submitError: error,
    ended,
    start: () => {
      dispatch({ type: "start" });
    },
    answer: (code, value) => {
      dispatch({ type: "answer", code, value });
    },
    back: () => {
      dispatch({ type: "back" });
    },
    next: () => {
      dispatch({ type: "next" });
    },
    submit,
  };
}
