import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStorage } from "../../support";
import { clearDraft, loadDraft, saveDraft } from "@/features/feedback-form/draft";
import {
  canGoNext,
  formReducer,
  initialState,
  stepLabel,
  type FormState,
} from "@/features/feedback-form/formMachine";
import { submitFeedback } from "@/features/feedback-form/submitFlow";
import { freshToken, happyAnswers, makeData } from "./helpers";

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
    storage.setItem("psf:draft:v1", "{not json");
    expect(loadDraft("v1")).toBeNull();
    storage.setItem("psf:draft:v1", JSON.stringify({ step: 9, answers: {} }));
    expect(loadDraft("v1")).toBeNull();
    storage.setItem("psf:draft:v1", JSON.stringify({ step: 2, answers: [] }));
    expect(loadDraft("v1")).toBeNull();
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

  it("Q1 = 2 opens Q1a; Q7 No -> Yes drops Q7a (F-3 triggers)", () => {
    let s = formReducer(started, { type: "answer", code: "Q7", value: "No" });
    s = formReducer(s, { type: "answer", code: "Q7a", value: "1 day late" });
    expect(s.answers["Q7a"]).toBe("1 day late");
    s = formReducer(s, { type: "answer", code: "Q7", value: "Yes" });
    expect(s.answers).not.toHaveProperty("Q7a");
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
  it("success clears the draft and reports the callback", async () => {
    const { da } = makeData();
    saveDraft("v-test-1", { step: 6, answers: {} });
    const out = await submitFeedback(da, freshToken(), "v-test-1", happyAnswers({ Q15: "Yes" }));
    expect(out).toEqual({ kind: "done", callbackRequested: true });
    expect(loadDraft("v-test-1")).toBeNull();
  });

  it("a failed save keeps the draft and Retry succeeds (S-13)", async () => {
    const { da } = makeData("?demoFail=1");
    const token = freshToken();
    saveDraft("v-test-1", { step: 6, answers: happyAnswers() });
    const out = await submitFeedback(da, token, "v-test-1", happyAnswers());
    expect(out).toEqual({ kind: "failed", message: "Couldn't save, try again" });
    expect(loadDraft("v-test-1")).not.toBeNull();
    expect((await submitFeedback(da, token, "v-test-1", happyAnswers())).kind).toBe("done");
  });

  it("maps already-submitted and invalid links", async () => {
    const { da } = makeData();
    const token = freshToken();
    await submitFeedback(da, token, "v-test-1", happyAnswers());
    expect((await submitFeedback(da, token, "v-test-1", happyAnswers())).kind).toBe("already");
    expect((await submitFeedback(da, "bogus", "v", happyAnswers())).kind).toBe("invalid");
  });
});
