import { QUESTIONNAIRE_V2 } from "@/domain/questionnaire";
import type { AnswerMap, AnswerValue, QuestionCode } from "@/domain/types";
import { isStepComplete, pruneHidden } from "@/domain/visibility";
import type { Draft } from "./draft";

export type Phase = "welcome" | "step" | "thanks";

export interface FormState {
  phase: Phase;
  /** 1..6 */
  step: number;
  answers: AnswerMap;
  callbackRequested: boolean;
  callbackSlot?: string | undefined;
}

export type FormAction =
  | { type: "start" }
  | { type: "answer"; code: QuestionCode; value: AnswerValue }
  | { type: "next" }
  | { type: "back" }
  | { type: "submitted"; callbackRequested: boolean; callbackSlot?: string | undefined };

export const LAST_STEP = QUESTIONNAIRE_V2.steps.length;

/** Starts at the welcome screen, or on the saved step when a draft exists. */
export function initialState(draft: Draft | null): FormState {
  if (draft === null) return { phase: "welcome", step: 1, answers: {}, callbackRequested: false };
  return { phase: "step", step: draft.step, answers: draft.answers, callbackRequested: false };
}

export function canGoNext(state: FormState): boolean {
  return state.phase === "step" && isStepComplete(state.step, state.answers);
}

export function isLastStep(state: FormState): boolean {
  return state.step === LAST_STEP;
}

/** "Step n of 6" */
export function stepLabel(step: number): string {
  return `Step ${String(step)} of ${String(LAST_STEP)}`;
}

function step(state: FormState, delta: 1 | -1): FormState {
  const target = state.step + delta;
  if (target < 1) return { ...state, phase: "welcome", step: 1 };
  return { ...state, step: Math.min(target, LAST_STEP) };
}

/** Pure reducer. Changing an answer drops follow-ups that became hidden (S-04). */
export function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "start":
      return { ...state, phase: "step", step: 1 };
    case "answer":
      return { ...state, answers: pruneHidden({ ...state.answers, [action.code]: action.value }) };
    case "next":
      return canGoNext(state) && !isLastStep(state) ? step(state, 1) : state;
    case "back":
      return state.phase === "step" ? step(state, -1) : state;
    case "submitted":
      return {
        ...state,
        phase: "thanks",
        callbackRequested: action.callbackRequested,
        callbackSlot: action.callbackSlot,
      };
  }
}
