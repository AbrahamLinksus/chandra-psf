import { QUESTIONNAIRE_V1 } from "@/domain/questionnaire";
import type { AnswerMap } from "@/domain/types";

export interface Draft {
  step: number;
  answers: AnswerMap;
}

const PREFIX = "psf:draft:";
const MAX_STEP = QUESTIONNAIRE_V1.steps.length;

const keyFor = (visitId: string): string => `${PREFIX}${visitId}`;

function isDraft(value: unknown): value is Draft {
  if (typeof value !== "object" || value === null) return false;
  const v = value as { step?: unknown; answers?: unknown };
  const stepOk =
    typeof v.step === "number" && Number.isInteger(v.step) && v.step >= 1 && v.step <= MAX_STEP;
  return stepOk && typeof v.answers === "object" && v.answers !== null && !Array.isArray(v.answers);
}

/** Saves answers and the current step so a reload resumes where the customer was (S-04). */
export function saveDraft(visitId: string, draft: Draft): void {
  try {
    localStorage.setItem(keyFor(visitId), JSON.stringify(draft));
  } catch {
    // storage full or blocked: the form still works, it just cannot resume
  }
}

/** Returns the saved draft, or null when none exists or it is unreadable. */
export function loadDraft(visitId: string): Draft | null {
  try {
    const raw = localStorage.getItem(keyFor(visitId));
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return isDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearDraft(visitId: string): void {
  try {
    localStorage.removeItem(keyFor(visitId));
  } catch {
    // nothing to clear
  }
}
