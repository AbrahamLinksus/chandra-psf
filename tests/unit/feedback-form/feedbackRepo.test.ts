/* eslint-disable max-lines-per-function -- describe blocks group many short tests */
import { describe, expect, it } from "vitest";
import { freshToken, happyAnswers, makeData, readList } from "./helpers";
import { submitFeedback } from "@/features/feedback-form/submitFlow";
import type { Alert, ResponseRecord, Visit } from "@/domain/types";

describe("feedback repo: link states", () => {
  it("welcome data for a link this browser has never seen is the personal one (S-12)", async () => {
    const { da, storage } = makeData();
    const res = await da.feedback.getVisitByToken(freshToken());
    expect(res.ok && res.value.state === "ready" && res.value.customerName).toBe("Ramesh Kumar");
    expect(res.ok && res.value.state === "ready" && res.value.model).toBe("Activa 6G");
    // reading is side-effect free: the visit is only stored once opened or submitted
    expect(readList<Visit>(storage, "visits").some((v) => v.id === "v-test-1")).toBe(false);
  });

  it("markOpened sets the visit to Opened once and keeps the first time (AC-3)", async () => {
    const { da, storage } = makeData();
    const token = freshToken();
    await da.feedback.getVisitByToken(token);
    expect((await da.feedback.markOpened(token)).ok).toBe(true);
    const first = readList<Visit>(storage, "visits").find((v) => v.id === "v-test-1");
    expect(first?.openedAt).not.toBeNull();
    await da.feedback.markOpened(token);
    const again = readList<Visit>(storage, "visits").find((v) => v.id === "v-test-1");
    expect(again?.openedAt).toBe(first?.openedAt);
  });

  it("unknown, garbled and wrong-job-card tokens are Link not valid (AC-5, G-01)", async () => {
    const { da } = makeData();
    for (const t of ["nonsense", "a.b", freshToken("v-x", 1, "JC-NOPE")]) {
      expect(await da.feedback.getVisitByToken(t)).toEqual({
        ok: true,
        value: { state: "invalid" },
      });
    }
    expect(await da.feedback.markOpened("nonsense")).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND", message: "Link not valid" },
    });
    expect(await da.feedback.submitResponse("nonsense", happyAnswers())).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
  });

  it("a link older than 7 days is expired, not replaced", async () => {
    const { da } = makeData();
    const res = await da.feedback.getVisitByToken(freshToken("v-old", 8));
    expect(res).toEqual({ ok: true, value: { state: "expired", replaced: false } });
    expect(await da.feedback.submitResponse(freshToken("v-old", 8), happyAnswers())).toMatchObject({
      ok: false,
      error: { code: "CONFLICT" },
    });
  });

  it("a stored visit is matched by visit and job card; another job card's link is invalid", async () => {
    const { da } = makeData();
    await da.feedback.markOpened(freshToken("v-same", 1));
    expect(await da.feedback.getVisitByToken(freshToken("v-same", 1, "JC-24-1001"))).toEqual({
      ok: true,
      value: { state: "invalid" },
    });
  });

  it("a link that expires after the page was opened is Expired on submit, not Couldn't save (AC-5)", async () => {
    const { da, storage } = makeData();
    const token = freshToken("v-exp", 1);
    await da.feedback.markOpened(token);
    const visits = readList<Visit>(storage, "visits").map((v) =>
      v.id === "v-exp" ? { ...v, expiresAt: "2026-03-10T06:00:00.000Z" } : v,
    );
    storage.setItem("psf:v1:visits", JSON.stringify(visits));
    const { da: d2 } = makeDataFrom(storage);
    expect(await submitFeedback(d2, token, "v-exp", happyAnswers())).toEqual({ kind: "expired" });
    expect(readList<ResponseRecord>(storage, "responses").some((r) => r.visitId === "v-exp")).toBe(
      false,
    );
  });

  it("a replaced visit reports expired with replaced = true (S-05)", async () => {
    const { da, storage } = makeData();
    const token = freshToken("v-rep", 1);
    await da.feedback.markOpened(token); // imports the visit
    const visits = readList<Visit>(storage, "visits").map((v) =>
      v.id === "v-rep" ? { ...v, replacedBy: "v-new" } : v,
    );
    storage.setItem("psf:v1:visits", JSON.stringify(visits));
    const { da: da2 } = makeDataFrom(storage);
    expect(await da2.feedback.getVisitByToken(token)).toEqual({
      ok: true,
      value: { state: "expired", replaced: true },
    });
  });

  it("a cancelled visit is Link not valid; a completed one is already submitted (AC-5)", async () => {
    const { da, storage } = makeData();
    const t1 = freshToken("v-can", 1);
    const t2 = freshToken("v-done", 1);
    await da.feedback.markOpened(t1);
    await da.feedback.submitResponse(t2, happyAnswers());
    const visits = readList<Visit>(storage, "visits").map((v) =>
      v.id === "v-can" ? { ...v, cancelledAt: "2026-03-09T00:00:00.000Z" } : v,
    );
    storage.setItem("psf:v1:visits", JSON.stringify(visits));
    const { da: d2 } = makeDataFrom(storage);
    expect(await d2.feedback.getVisitByToken(t1)).toEqual({
      ok: true,
      value: { state: "invalid" },
    });
    expect(await d2.feedback.submitResponse(t1, happyAnswers())).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
    expect(await d2.feedback.getVisitByToken(t2)).toEqual({
      ok: true,
      value: { state: "completed" },
    });
    expect(await d2.feedback.submitResponse(t2, happyAnswers())).toMatchObject({
      ok: false,
      error: { code: "ALREADY_COMPLETED" },
    });
  });
});

import { createLocalDataAccess } from "@/data/local/createLocalDataAccess";
import { fixedClock, type MemoryStorage } from "../../support";

function makeDataFrom(storage: MemoryStorage) {
  window.sessionStorage.clear();
  return { da: createLocalDataAccess({ storage, locks: null, clock: fixedClock(), win: window }) };
}

describe("feedback repo: submit", () => {
  it("Q12 = 1 and Q15 = Yes completes the visit and stores one alert (AC-7, S-04, S-12)", async () => {
    const { da, storage } = makeData();
    const token = freshToken();
    const res = await da.feedback.submitResponse(token, happyAnswers({ Q12: 1, Q15: "Yes" }));
    expect(res).toEqual({ ok: true, value: { callbackRequested: true } });
    const visit = readList<Visit>(storage, "visits").find((v) => v.id === "v-test-1");
    expect(visit?.completedAt).not.toBeNull();
    expect(visit?.openedAt).not.toBeNull();
    const response = readList<ResponseRecord>(storage, "responses").find(
      (r) => r.visitId === "v-test-1",
    );
    const alerts = readList<Alert>(storage, "alerts").filter((a) => a.responseId === response?.id);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.reasons).toEqual([{ kind: "callback" }, { kind: "low_rating", code: "Q12" }]);
  });

  it("Q3 = Yes alone stores no alert", async () => {
    const { da, storage } = makeData();
    await da.feedback.getVisitByToken(freshToken());
    const before = readList<Alert>(storage, "alerts").length;
    const res = await da.feedback.submitResponse(
      freshToken(),
      happyAnswers({ Q3: "Yes", Q3a: { options: ["Engine"] } }),
    );
    expect(res).toMatchObject({ ok: true, value: { callbackRequested: false } });
    expect(readList<Alert>(storage, "alerts")).toHaveLength(before);
  });

  it("a hidden follow-up answer is not saved (Q7 No then Yes, S-04)", async () => {
    const { da, storage } = makeData();
    await da.feedback.submitResponse(freshToken(), happyAnswers({ Q7a: "1 day late" }));
    const r = readList<ResponseRecord>(storage, "responses").find((x) => x.visitId === "v-test-1");
    expect(r?.answers).not.toHaveProperty("Q7a");
    expect(r?.answers["Q7"]).toBe("Yes");
  });

  it("missing required answers are a VALIDATION error and store nothing", async () => {
    const { da, storage } = makeData();
    const res = await da.feedback.submitResponse(freshToken(), { Q1: 5 });
    expect(res).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    expect(
      readList<ResponseRecord>(storage, "responses").some((r) => r.visitId === "v-test-1"),
    ).toBe(false);
  });

  it("text with <script>, Tamil and emoji is stored verbatim (G-05, G-W3)", async () => {
    const { da, storage } = makeData();
    const text = "<script>alert(1)</script> வணக்கம் 😀";
    await da.feedback.submitResponse(freshToken(), happyAnswers({ Q14: text }));
    const r = readList<ResponseRecord>(storage, "responses").find((x) => x.visitId === "v-test-1");
    expect(r?.answers["Q14"]).toBe(text);
  });

  it("a simulated failed save returns SAVE_FAILED, keeps nothing, and a retry succeeds (S-13)", async () => {
    const { da, storage } = makeData("?demoFail=1");
    const token = freshToken();
    const first = await da.feedback.submitResponse(token, happyAnswers());
    expect(first).toMatchObject({ ok: false, error: { code: "SAVE_FAILED" } });
    expect(
      readList<ResponseRecord>(storage, "responses").some((r) => r.visitId === "v-test-1"),
    ).toBe(false);
    const second = await da.feedback.submitResponse(token, happyAnswers());
    expect(second.ok).toBe(true);
  });

  it("opening the link does not use up the armed failed save (S-13)", async () => {
    const { da } = makeData("?demoFail=1");
    const token = freshToken();
    await da.feedback.getVisitByToken(token);
    await da.feedback.markOpened(token);
    const first = await da.feedback.submitResponse(token, happyAnswers());
    expect(first).toMatchObject({ ok: false, error: { code: "SAVE_FAILED" } });
    expect((await da.feedback.submitResponse(token, happyAnswers())).ok).toBe(true);
  });
});
