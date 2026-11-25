/* eslint-disable max-lines-per-function -- describe blocks group many one-line tests */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStorage } from "../../support/memoryStorage";
import { err, ok } from "@/data/access";
import { clearDraft, loadDraft, saveDraft } from "@/features/feedback-form/draft";
import {
  canGoNext,
  formReducer,
  initialState,
  stepLabel,
  type FormState,
} from "@/features/feedback-form/formMachine";
import { submitFeedback } from "@/features/feedback-form/submitFlow";
import { fakeDataAccess } from "../../support/fakeDataAccess";
import { happyAnswers } from "./helpers";

let storage = new MemoryStorage();

beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal("localStorage", storage);
});

describe("draft", () => {
  it("restores step and answers after a reload (S-04, AC-4)", () => {
    saveDraft("v1", { step: 4, answers: { Q1: 2 } });
    expect(loadDraft("v1")).toEqual({ step: 4, answers: { Q1: 2 } });
    clearDraft("v1");
    expect(loadDraft("v1")).toBeNull();
  });

  it("ignores unreadable or out-of-range drafts", () => {
    storage.setItem("psf:draft:v2:v1", "{not json");
    expect(loadDraft("v1")).toBeNull();
    storage.setItem("psf:draft:v2:v1", JSON.stringify({ step: 9, answers: {} }));
    expect(loadDraft("v1")).toBeNull();
    storage.setItem("psf:draft:v2:v1", JSON.stringify({ step: 2, answers: [] }));
    expect(loadDraft("v1")).toBeNull();
  });
});

describe("v1 draft", () => {
  it("a draft saved under v1 (unversioned key) is discarded and never loaded", () => {
    storage.setItem("psf:draft:v-1", JSON.stringify({ step: 4, answers: { Q12: 3 } }));
    expect(loadDraft("v-1")).toBeNull();
    expect(storage.getItem("psf:draft:v-1")).toBeNull();
  });
});

describe("form machine", () => {
  const started: FormState = { ...initialState(null), phase: "step" };

  it("starts on welcome, or on the saved step when a draft exists", () => {
    expect(initialState(null).phase).toBe("welcome");
    expect(initialState({ step: 4, answers: { Q1: 2 } })).toMatchObject({ phase: "step", step: 4 });
    expect(stepLabel(3)).toBe("Step 3 of 6");
  });

  it("Next stays disabled until the step is complete; Back keeps answers (AC-11)", () => {
    expect(canGoNext(started)).toBe(false);
    expect(formReducer(started, { type: "next" })).toBe(started);
    let s = started;
    for (const [code, value] of Object.entries({ Q1: 5, Q2: "Yes", Q3: "No" })) {
      s = formReducer(s, { type: "answer", code: code as "Q1", value });
    }
    expect(canGoNext(s)).toBe(true);
    const next = formReducer(s, { type: "next" });
    expect(next.step).toBe(2);
    const back = formReducer(next, { type: "back" });
    expect(back.step).toBe(1);
    expect(back.answers).toEqual(s.answers);
    expect(formReducer(back, { type: "back" }).phase).toBe("welcome");
  });

  it("Q1 = 2 opens Q1a, 3 does not; Q5 No -> Yes drops Q5a (F-3 triggers)", () => {
    let s = formReducer(started, { type: "answer", code: "Q1", value: 2 });
    s = formReducer(s, { type: "answer", code: "Q1a", value: { options: ["Other"] } });
    expect(s.answers["Q1a"]).toEqual({ options: ["Other"] });
    s = formReducer(s, { type: "answer", code: "Q1", value: 3 });
    expect(s.answers).not.toHaveProperty("Q1a");
    s = formReducer(s, { type: "answer", code: "Q5", value: "No" });
    s = formReducer(s, { type: "answer", code: "Q5a", value: "1 Day" });
    expect(s.answers["Q5a"]).toBe("1 Day");
    s = formReducer(s, { type: "answer", code: "Q5", value: "Yes" });
    expect(s.answers).not.toHaveProperty("Q5a");
  });

  it("does not advance past the last step; submitted moves to thanks", () => {
    const last: FormState = { ...started, step: 6, answers: happyAnswers() };
    expect(formReducer(last, { type: "next" }).step).toBe(6);
    expect(formReducer(last, { type: "submitted", callbackRequested: true })).toMatchObject({
      phase: "thanks",
      callbackRequested: true,
    });
  });
});

describe("submitFeedback", () => {
  const fail = (code: "SAVE_FAILED" | "ALREADY_COMPLETED" | "NOT_FOUND" | "CONFLICT") => () =>
    Promise.resolve(err<{ callbackRequested: boolean }>(code, "x"));

  it("success clears the draft and reports the callback", async () => {
    const da = fakeDataAccess({
      feedback: { submitResponse: () => Promise.resolve(ok({ callbackRequested: true })) },
    });
    saveDraft("v-1", { step: 6, answers: {} });
    const out = await submitFeedback(
      da,
      "tok",
      "v-1",
      happyAnswers({ Q10: "Yes", Q10a: "Evening (3 PM–6 PM)" }),
    );
    expect(out).toEqual({ kind: "done", callbackRequested: true });
    expect(loadDraft("v-1")).toBeNull();
  });

  it("a failed save keeps the draft and Retry succeeds (S-13)", async () => {
    let first = true;
    const da = fakeDataAccess({
      feedback: {
        submitResponse: () => {
          if (first) {
            first = false;
            return fail("SAVE_FAILED")();
          }
          return Promise.resolve(ok({ callbackRequested: false }));
        },
      },
    });
    saveDraft("v-1", { step: 6, answers: happyAnswers() });
    const out = await submitFeedback(da, "tok", "v-1", happyAnswers());
    expect(out).toEqual({ kind: "failed", message: "Couldn't save, try again" });
    expect(loadDraft("v-1")).not.toBeNull();
    expect((await submitFeedback(da, "tok", "v-1", happyAnswers())).kind).toBe("done");
  });

  it.each([
    ["ALREADY_COMPLETED", "already"],
    ["NOT_FOUND", "invalid"],
    ["CONFLICT", "expired"],
  ] as const)("maps %s to %s", async (code, kind) => {
    const da = fakeDataAccess({ feedback: { submitResponse: fail(code) } });
    expect((await submitFeedback(da, "tok", "v-1", happyAnswers())).kind).toBe(kind);
  });
});
