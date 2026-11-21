/* eslint-disable max-lines-per-function -- describe blocks group many one-line tests */
import { describe, expect, it } from "vitest";
import { AUTO_RESOLVE_NOTE } from "@/domain/constants";
import { evaluateAlertReasons, formatReasons, reconcileAlert } from "@/domain/alertRules";
import { findQuestion, QUESTIONNAIRE_V1 } from "@/domain/questionnaire";
import { SeedSchema } from "@/domain/schemas";
import type { Alert, AnswerMap, QuestionCode } from "@/domain/types";
import {
  isStepComplete,
  isVisible,
  pruneHidden,
  validateSubmission,
  visibleQuestions,
} from "@/domain/visibility";
import seedJson from "@/data/seed/seed.json";

function visible(code: QuestionCode, answers: AnswerMap): boolean {
  const q = findQuestion(code);
  if (q === undefined) throw new Error(`unknown ${code}`);
  return isVisible(q, answers);
}

describe("visibility (SPEC F-3 triggers)", () => {
  it.each([
    ["Q1a", "Q1", 3, 4],
    ["Q6a", "Q6", 3, 4],
    ["Q11a", "Q11", 3, 4],
  ] as const)("%s shows when %s <= 3, hidden at 4", (child, parent, low, high) => {
    expect(visible(child, { [parent]: low })).toBe(true);
    expect(visible(child, { [parent]: 1 })).toBe(true);
    expect(visible(child, { [parent]: high })).toBe(false);
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

  it.each([
    ["Q7a", "Q7"],
    ["Q9a", "Q9"],
    ["Q13a", "Q13"],
  ] as const)("%s shows when %s = No only", (child, parent) => {
    expect(visible(child, { [parent]: "No" })).toBe(true);
    expect(visible(child, { [parent]: "Yes" })).toBe(false);
  });

  it("visibleQuestions lists a step's follow-ups only when triggered", () => {
    const codes = (a: AnswerMap) => visibleQuestions(1, a).map((q) => q.code);
    expect(codes({})).toEqual(["Q1", "Q2", "Q3"]);
    expect(codes({ Q1: 2, Q2: "No", Q3: "Yes" })).toEqual(["Q1", "Q1a", "Q2", "Q2a", "Q3", "Q3a"]);
  });

  it("isStepComplete needs the visible follow-up answered", () => {
    const base: AnswerMap = { Q1: 2, Q2: "Yes", Q3: "No" };
    expect(isStepComplete(1, base)).toBe(false);
    expect(isStepComplete(1, { ...base, Q1a: { options: ["Other"], text: "x" } })).toBe(true);
  });

  it("pruneHidden drops answers of hidden follow-ups", () => {
    const pruned = pruneHidden({ Q1: 5, Q1a: { options: ["Other"] }, Q3: "No" });
    expect(pruned).toEqual({ Q1: 5, Q3: "No" });
  });

  it("validateSubmission reports missing required codes, then accepts a full valid set", () => {
    const bad = validateSubmission({ Q1: 5 });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.missing).toContain("Q2");
    const full: AnswerMap = {
      Q1: 5,
      Q2: "Yes",
      Q3: "No",
      Q4: "Yes",
      Q5: "Yes",
      Q6: 5,
      Q7: "Yes",
      Q8: "Yes",
      Q9: "Yes",
      Q10: "Yes",
      Q11: 5,
      Q12: 5,
      Q13: "Yes",
      Q15: "No",
    };
    const good = validateSubmission({ ...full, Q1a: { options: ["Other"] } });
    expect(good.ok).toBe(true);
    if (good.ok) expect(good.answers["Q1a"]).toBeUndefined();
  });

  it("text over 1000 characters is invalid", () => {
    const q = QUESTIONNAIRE_V1.questions.find((x) => x.code === "Q14");
    expect(q).toBeDefined();
    const r = validateSubmission({ Q14: "x".repeat(1001) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.missing).toContain("Q14");
  });
});

describe("alert rules (SPEC F-4)", () => {
  it("Q12 = 1 and Q15 = Yes → 'Callback requested · Q12 rated 1'", () => {
    const reasons = evaluateAlertReasons({ Q12: 1, Q15: "Yes" });
    expect(reasons).toEqual([{ kind: "callback" }, { kind: "low_rating", code: "Q12" }]);
    expect(formatReasons(reasons)).toBe("Callback requested · Q12 rated 1");
  });

  it("Q3 = Yes alone raises no reason", () => {
    expect(evaluateAlertReasons({ Q3: "Yes" })).toEqual([]);
  });

  it("orders Q1, Q6, Q11, Q12 low ratings after the callback; rating 2 is not low", () => {
    const reasons = evaluateAlertReasons({ Q12: 1, Q11: 1, Q6: 1, Q1: 1, Q15: "Yes" });
    expect(formatReasons(reasons)).toBe(
      "Callback requested · Q1 rated 1 · Q6 rated 1 · Q11 rated 1 · Q12 rated 1",
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

describe("seed fixture", () => {
  it("minimal seed passes SeedSchema with 1 admin, 2 support, 4 advisors and JC-24-1042", () => {
    const seed = SeedSchema.parse(seedJson);
    expect(seed.users.filter((u) => u.role === "admin")).toHaveLength(1);
    expect(seed.users.filter((u) => u.role === "support")).toHaveLength(2);
    expect(seed.advisors).toHaveLength(4);
    expect(seed.jobCards.map((j) => j.jobCardNo)).toContain("JC-24-1042");
  });
});
