import { AUTO_RESOLVE_NOTE, SYSTEM_ACTOR } from "./constants";
import type { Alert, AlertReason, AnswerMap } from "./types";

const RATED = ["Q1", "Q4", "Q8"] as const;

/** SPEC F-4 step 1 (v2): callback (with its time slot) first, then Q1, Q4, Q8 rated 1. Q3 = Yes alone raises none. */
export function evaluateAlertReasons(answers: AnswerMap): AlertReason[] {
  const reasons: AlertReason[] = [];
  if (answers.Q10 === "Yes") {
    const slot = answers.Q10a;
    reasons.push(typeof slot === "string" ? { kind: "callback", slot } : { kind: "callback" });
  }
  for (const code of RATED) {
    if (answers[code] === 1) reasons.push({ kind: "low_rating", code });
  }
  return reasons;
}

/** "Evening (3 PM–6 PM)" -> "Evening 3 PM–6 PM". */
export function slotLabel(slot: string): string {
  return slot.replace(/ \((.*)\)$/, " $1");
}

function formatReason(r: AlertReason): string {
  if (r.kind === "low_rating") return `${r.code} rated 1`;
  return r.slot === undefined ? "Callback requested" : `Callback requested (${slotLabel(r.slot)})`;
}

export function formatReasons(reasons: AlertReason[]): string {
  return reasons.map(formatReason).join(" · ");
}

export type AlertChange = "none" | "created" | "reasons_updated" | "auto_resolved";

function sameReasons(a: AlertReason[], b: AlertReason[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** SPEC F-4 step 4. `ids` is only used when a new alert is created (the repository supplies real ids). */
export function reconcileAlert(
  existing: Alert | null,
  reasons: AlertReason[],
  now: Date,
  ids?: { id: string; responseId: string },
): { alert: Alert | null; change: AlertChange } {
  const at = now.toISOString();
  if (existing === null) {
    if (reasons.length === 0) return { alert: null, change: "none" };
    if (ids === undefined)
      throw new RangeError("reconcileAlert: ids are required to create an alert");
    const alert: Alert = {
      ...ids,
      reasons,
      status: "open",
      notes: [],
      createdAt: at,
      updatedAt: at,
    };
    return { alert, change: "created" };
  }
  if (reasons.length === 0 && existing.status !== "resolved") {
    const note = { at, by: SYSTEM_ACTOR, text: AUTO_RESOLVE_NOTE };
    const alert: Alert = {
      ...existing,
      status: "resolved",
      notes: [...existing.notes, note],
      updatedAt: at,
    };
    return { alert, change: "auto_resolved" };
  }
  if (reasons.length === 0) return { alert: existing, change: "none" };
  if (sameReasons(existing.reasons, reasons)) return { alert: existing, change: "none" };
  return { alert: { ...existing, reasons, updatedAt: at }, change: "reasons_updated" };
}
