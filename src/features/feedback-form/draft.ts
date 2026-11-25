import { QUESTIONNAIRE_V2 } from "@/domain/questionnaire";
import type { AnswerMap } from "@/domain/types";

export interface Draft {
  step: number;
  answers: AnswerMap;
}

const LEGACY_PREFIX = "psf:draft:";
const PREFIX = `${LEGACY_PREFIX}v${String(QUESTIONNAIRE_V2.version)}:`;
const MAX_STEP = QUESTIONNAIRE_V2.steps.length;

const keyFor = (visitId: string): string => `${PREFIX}${visitId}`;

/** A draft saved under the old questionnaire (no version in its key) is discarded, never loaded. */
function dropLegacy(visitId: string): void {
  localStorage.removeItem(`${LEGACY_PREFIX}${visitId}`);
}

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
    dropLegacy(visitId);
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
    dropLegacy(visitId);
  } catch {
    // nothing to clear
  }
}

const SUBMISSION_PREFIX = "psf:submission:";

/** One id per visit on this phone, reused by every retry so the server can replay a lost reply (G-15). */
export function submissionIdFor(visitId: string): string {
  const key = `${SUBMISSION_PREFIX}${visitId}`;
  try {
    const saved = localStorage.getItem(key);
    if (saved !== null) return saved;
    const fresh = crypto.randomUUID();
    localStorage.setItem(key, fresh);
    return fresh;
  } catch {
    return crypto.randomUUID();
  }
}
