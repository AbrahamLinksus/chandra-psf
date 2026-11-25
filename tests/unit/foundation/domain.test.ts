/* eslint-disable max-lines-per-function -- describe blocks group many one-line tests */
import { describe, expect, it } from "vitest";
import { AUTO_RESOLVE_NOTE } from "@/domain/constants";
import { evaluateAlertReasons, formatReasons, reconcileAlert } from "@/domain/alertRules";
import { findQuestion } from "@/domain/questionnaire";
import type { Alert, AnswerMap, QuestionCode } from "@/domain/types";
import {
  findStrayAnswers,
  isStepComplete,
  isVisible,
  pruneHidden,
  validateSubmission,
  visibleQuestions,
} from "@/domain/visibility";

function visible(code: QuestionCode, answers: AnswerMap): boolean {
  const q = findQuestion(code);
  if (q === undefined) throw new Error(`unknown ${code}`);
  return isVisible(q, answers);
}

const FULL: AnswerMap = {
  Q1: 5,
  Q2: "Yes",
  Q3: "No",
  Q4: 5,
  Q5: "Yes",
  Q6: "Yes",
  Q7: "Yes",
  Q8: 5,
  Q9: "Yes",
  Q9a: "Trust & Reliability",
  Q10: "No",
};

describe("visibility (SPEC F-3 v2 triggers)", () => {
  it.each([
    ["Q1a", "Q1"],
    ["Q4a", "Q4"],
    ["Q8a", "Q8"],
  ] as const)("%s shows when %s is 1 or 2, hidden at 3", (child, parent) => {
    expect(visible(child, { [parent]: 2 })).toBe(true);
    expect(visible(child, { [parent]: 1 })).toBe(true);
    expect(visible(child, { [parent]: 3 })).toBe(false);
    expect(visible(child, {})).toBe(false);
  });

  it("Q2a shows for Partially and No, hidden for Yes", () => {
    expect(visible("Q2a", { Q2: "Partially" })).toBe(true);
    expect(visible("Q2a", { Q2: "No" })).toBe(true);
    expect(visible("Q2a", { Q2: "Yes" })).toBe(false);
  });

  it("Q3a shows when Q3 = Yes only", () => {
    expect(visible("Q3a", { Q3: "Yes" })).toBe(true);
    expect(visible("Q3a", { Q3: "No" })).toBe(false);
  });

  it("Q5a and Q6a show on No only; Q9a on Yes or No; Q10a on Yes only", () => {
    expect(visible("Q5a", { Q5: "No" })).toBe(true);
    expect(visible("Q5a", { Q5: "Yes" })).toBe(false);
    expect(visible("Q6a", { Q6: "No" })).toBe(true);
    expect(visible("Q6a", { Q6: "Yes" })).toBe(false);
    expect(visible("Q9a", { Q9: "Yes" })).toBe(true);
    expect(visible("Q9a", { Q9: "No" })).toBe(true);
    expect(visible("Q9a", {})).toBe(false);
    expect(visible("Q10a", { Q10: "Yes" })).toBe(true);
    expect(visible("Q10a", { Q10: "No" })).toBe(false);
  });

  it("visibleQuestions lists a step's follow-ups only when triggered", () => {
    const codes = (a: AnswerMap) => visibleQuestions(1, a).map((q) => q.code);
    expect(codes({})).toEqual(["Q1", "Q2", "Q3"]);
    expect(codes({ Q1: 2, Q2: "No", Q3: "Yes" })).toEqual(["Q1", "Q1a", "Q2", "Q2a", "Q3", "Q3a"]);
  });

  it("isStepComplete needs the visible follow-ups answered, Q2a text required", () => {
    const base: AnswerMap = { Q1: 5, Q2: "Partially", Q3: "No" };
    expect(isStepComplete(1, base)).toBe(false);
    expect(isStepComplete(1, { ...base, Q2a: "   " })).toBe(false);
    expect(isStepComplete(1, { ...base, Q2a: "Brake noise" })).toBe(true);
    expect(isStepComplete(1, { ...base, Q1: 2, Q2a: "x" })).toBe(false);
    expect(isStepComplete(1, { ...base, Q1: 2, Q2a: "x", Q1a: { options: ["Other"] } })).toBe(true);
  });

  it("pruneHidden drops answers of hidden follow-ups", () => {
    const pruned = pruneHidden({ Q1: 5, Q1a: { options: ["Other"] }, Q3: "No" });
    expect(pruned).toEqual({ Q1: 5, Q3: "No" });
  });

  it("validateSubmission reports missing required codes, then accepts a full valid set", () => {
    const bad = validateSubmission({ Q1: 5 });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.missing).toContain("Q2");
    const good = validateSubmission({ ...FULL, Q1a: { options: ["Other"] } });
    expect(good.ok).toBe(true);
    if (good.ok) expect(good.answers["Q1a"]).toBeUndefined();
  });

  it("Q10 = Yes requires a slot; Q9 needs its reason", () => {
    const noSlot = validateSubmission({ ...FULL, Q10: "Yes" });
    expect(noSlot.ok).toBe(false);
    if (!noSlot.ok) expect(noSlot.missing).toEqual(["Q10a"]);
    const ok = validateSubmission({ ...FULL, Q10: "Yes", Q10a: "Evening (3 PM–6 PM)" });
    expect(ok.ok).toBe(true);
    const noReason = { ...FULL };
    delete noReason["Q9a"];
    expect(validateSubmission(noReason).ok).toBe(false);
  });

  it("findStrayAnswers flags v1 codes and hidden follow-ups", () => {
    expect(findStrayAnswers({ ...FULL, Q14: "x", Q12: 3 }).sort()).toEqual(["Q12", "Q14"]);
    expect(findStrayAnswers({ ...FULL, Q1a: { options: ["Other"] } })).toEqual(["Q1a"]);
    expect(findStrayAnswers(FULL)).toEqual([]);
  });

  it("text over 1000 characters is invalid", () => {
    const r = validateSubmission({ ...FULL, Q2: "No", Q2a: "x".repeat(1001) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.missing).toContain("Q2a");
  });
});

describe("alert rules (SPEC F-4 v2)", () => {
  it("Q1 = 1 and Q10 = Yes + Evening → 'Callback requested (Evening 3 PM–6 PM) · Q1 rated 1'", () => {
    const reasons = evaluateAlertReasons({ Q1: 1, Q10: "Yes", Q10a: "Evening (3 PM–6 PM)" });
    expect(formatReasons(reasons)).toBe("Callback requested (Evening 3 PM–6 PM) · Q1 rated 1");
  });

  it("Q3 = Yes alone raises no reason", () => {
    expect(evaluateAlertReasons({ Q3: "Yes" })).toEqual([]);
  });

  it("orders Q1, Q4, Q8 low ratings after the callback; rating 2 is not low", () => {
    const reasons = evaluateAlertReasons({ Q8: 1, Q4: 1, Q1: 1, Q10: "Yes" });
    expect(formatReasons(reasons)).toBe(
      "Callback requested · Q1 rated 1 · Q4 rated 1 · Q8 rated 1",
    );
    expect(evaluateAlertReasons({ Q1: 2 })).toEqual([]);
  });
});

describe("reconcileAlert", () => {
  const now = new Date("2026-03-10T06:30:00.000Z");
  const open: Alert = {
    id: "al-1",
    responseId: "r-1",
    reasons: [{ kind: "callback" }],
    status: "open",
    notes: [],
    createdAt: "2026-03-09T06:30:00.000Z",
    updatedAt: "2026-03-09T06:30:00.000Z",
  };

  it("no alert and no reasons → none", () => {
    expect(reconcileAlert(null, [], now)).toEqual({ alert: null, change: "none" });
  });

  it("no alert but reasons → created open", () => {
    const r = reconcileAlert(null, [{ kind: "callback" }], now, { id: "al-9", responseId: "r-9" });
    expect(r.change).toBe("created");
    expect(r.alert?.status).toBe("open");
    expect(r.alert?.id).toBe("al-9");
  });

  it("existing alert and reasons gone → auto-resolved with the note text", () => {
    const r = reconcileAlert(open, [], now);
    expect(r.change).toBe("auto_resolved");
    expect(r.alert?.status).toBe("resolved");
    expect(r.alert?.notes.at(-1)?.text).toBe("Auto-resolved: no alert reason after edit");
    expect(AUTO_RESOLVE_NOTE).toBe("Auto-resolved: no alert reason after edit");
  });

  it("already resolved and no reasons → unchanged", () => {
    const resolved: Alert = { ...open, status: "resolved", reasons: [] };
    expect(reconcileAlert(resolved, [], now).change).toBe("none");
  });

  it("different reasons → reasons_updated; same reasons → none", () => {
    const changed = reconcileAlert(open, [{ kind: "low_rating", code: "Q1" }], now);
    expect(changed.change).toBe("reasons_updated");
    expect(reconcileAlert(open, [{ kind: "callback" }], now).change).toBe("none");
  });
});
