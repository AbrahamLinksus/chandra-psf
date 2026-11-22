/* eslint-disable max-lines-per-function -- describe blocks group many one-line tests */
import { describe, expect, it } from "vitest";
import { Browser, fixedClock, signInAs } from "../../support";
import { LocalAlertRepo } from "@/data/local/repos/alerts";
import { LocalResponseRepo } from "@/data/local/repos/responses";
import { StoreSessionReader } from "@/data/local/session";
import type { Result } from "@/data/access/result";
import type { AnswerMap } from "@/domain/types";

function value<T>(r: Result<T>): T {
  if (!r.ok) throw new Error(`unexpected ${r.error.code}`);
  return r.value;
}

const PW = { password: "Demo@2026" };
const WRONG = { password: "nope-nope" };
const WIDE = { from: "2000-01-01", to: "2100-12-31" };

async function setup(who: "admin" | "support1" | null = "admin") {
  const browser = new Browser();
  const tab = browser.openTab();
  await tab.store.whenReady();
  if (who !== null) signInAs(tab, who);
  const deps = {
    store: tab.store,
    clock: fixedClock(),
    session: new StoreSessionReader(tab.store),
  };
  return { tab, repo: new LocalResponseRepo(deps), alerts: new LocalAlertRepo(deps) };
}

type Ctx = Awaited<ReturnType<typeof setup>>;

function answersOf(ctx: Ctx, id: string): AnswerMap {
  const r = ctx.tab.store.read("responses").find((x) => x.id === id);
  if (!r) throw new Error(`no ${id}`);
  return r.answers;
}

function auditFor(ctx: Ctx, action: string) {
  return ctx.tab.store.read("audit").filter((a) => a.action === action);
}

describe("browse and filter (S-11, AC-10)", () => {
  it("filters by date, vehicle type, model and advisor", async () => {
    const { repo, tab } = await setup();
    const all = value(await repo.listResponses(WIDE));
    expect(all).toHaveLength(33);
    const cards = tab.store.read("jobCards");
    const visits = tab.store.read("visits");
    const responses = tab.store.read("responses");
    const cardOf = (rid: string) => {
      const v = visits.find((x) => x.id === responses.find((r) => r.id === rid)?.visitId);
      return cards.find((c) => c.jobCardNo === v?.jobCardNo);
    };
    const sample = cardOf(all[0]?.id ?? "");
    if (!sample) throw new Error("no card");

    const byModel = value(await repo.listResponses({ ...WIDE, model: sample.model }));
    expect(byModel.length).toBeGreaterThan(0);
    expect(byModel.map((r) => r.model)).toEqual(byModel.map(() => sample.model));

    const byType = value(await repo.listResponses({ ...WIDE, vehicleType: sample.vehicleType }));
    expect(byType.map((r) => cardOf(r.id)?.vehicleType)).toEqual(
      byType.map(() => sample.vehicleType),
    );

    const byAdvisor = value(await repo.listResponses({ ...WIDE, advisorId: sample.advisorId }));
    expect(byAdvisor.map((r) => cardOf(r.id)?.advisorId)).toEqual(
      byAdvisor.map(() => sample.advisorId),
    );
    expect(byAdvisor.length).toBeLessThan(33);

    const day = value(
      await repo.listResponses({ from: sample.serviceDate, to: sample.serviceDate }),
    );
    expect(day.map((r) => r.serviceDate)).toEqual(day.map(() => sample.serviceDate));
    expect(value(await repo.listResponses({ from: "2020-01-01", to: "2020-01-02" }))).toEqual([]);
  });

  it("getResponse returns every answer with visit, vehicle, questionnaire and alert", async () => {
    const { repo } = await setup();
    const r = await repo.getResponse("r-s020");
    if (!r.ok) throw new Error("get failed");
    expect(r.value.response.answers.Q6a).toEqual({ options: ["Didn't answer queries"] });
    expect(r.value.jobCard.customerName).not.toBe("");
    expect(r.value.jobCard.advisorName).not.toBe("");
    expect(r.value.visit.jobCardNo).toBe(r.value.jobCard.jobCardNo);
    expect(r.value.alert?.responseId).toBe("r-s020");
    expect(r.value.questionnaire.questions.length).toBeGreaterThan(15);
  });
});

describe("edit with password (AC-9, G-01)", () => {
  it("Q6 2 → 4 drops Q6a and audits old and new (raw Q6a answer object)", async () => {
    const ctx = await setup();
    const next = { ...answersOf(ctx, "r-s020"), Q6: 4 };
    const r = await ctx.repo.editResponse("r-s020", next, PW);
    if (!r.ok) throw new Error(JSON.stringify(r.error));
    expect(r.value.response.answers.Q6).toBe(4);
    expect(r.value.response.answers.Q6a).toBeUndefined();
    const [entry] = auditFor(ctx, "response.edit");
    expect(entry?.oldValue).toEqual({ Q6: 2, Q6a: { options: ["Didn't answer queries"] } });
    expect(entry?.newValue).toEqual({ Q6: 4 });
    expect(entry?.entityId).toBe("r-s020");
  });

  it("a wrong password returns BAD_PASSWORD and saves nothing", async () => {
    const ctx = await setup();
    const before = JSON.stringify(ctx.tab.store.read("responses"));
    const auditBefore = ctx.tab.store.read("audit").length;
    const next = { ...answersOf(ctx, "r-s020"), Q6: 4 };
    const r = await ctx.repo.editResponse("r-s020", next, WRONG);
    expect(!r.ok && r.error.code).toBe("BAD_PASSWORD");
    expect(!r.ok && r.error.message).toBe("Password incorrect");
    expect(JSON.stringify(ctx.tab.store.read("responses"))).toBe(before);
    expect(ctx.tab.store.read("audit")).toHaveLength(auditBefore);
  });

  it("missing required answers return VALIDATION and save nothing", async () => {
    const ctx = await setup();
    const rest: AnswerMap = { ...answersOf(ctx, "r-s001") };
    delete rest.Q2;
    const r = await ctx.repo.editResponse("r-s001", rest, PW);
    expect(!r.ok && r.error.code).toBe("VALIDATION");
    expect(answersOf(ctx, "r-s001").Q2).toBe("Yes");
  });

  it("an unknown id returns NOT_FOUND", async () => {
    const ctx = await setup();
    const r = await ctx.repo.editResponse("r-nope", answersOf(ctx, "r-s001"), PW);
    expect(!r.ok && r.error.code).toBe("NOT_FOUND");
  });

  it("a failed save (S-13) returns SAVE_FAILED and keeps the stored answers", async () => {
    const ctx = await setup();
    const before = JSON.stringify(answersOf(ctx, "r-s020"));
    ctx.tab.fault.armNextWrite();
    const r = await ctx.repo.editResponse("r-s020", { ...answersOf(ctx, "r-s020"), Q6: 4 }, PW);
    expect(!r.ok && r.error.code).toBe("SAVE_FAILED");
    expect(JSON.stringify(answersOf(ctx, "r-s020"))).toBe(before);
    expect(auditFor(ctx, "response.edit")).toHaveLength(0);
  });
});

describe("alerts re-evaluated after an edit (S-08)", () => {
  it("Q12 1 → 4 on an only-reason alert resolves it with the auto-resolve note, audited", async () => {
    const ctx = await setup();
    const base = answersOf(ctx, "r-s001");
    const low = value(await ctx.repo.editResponse("r-s001", { ...base, Q12: 1 }, PW));
    expect(low.alert?.reasons).toEqual([{ kind: "low_rating", code: "Q12" }]);
    expect(low.alert?.status).toBe("open");
    const fixed = value(await ctx.repo.editResponse("r-s001", { ...base, Q12: 4 }, PW));
    expect(fixed.alert?.status).toBe("resolved");
    const note = "Auto-resolved: no alert reason after edit";
    expect(fixed.alert?.notes.at(-1)?.text).toBe(note);
    const status = auditFor(ctx, "alert.status").at(-1);
    expect([status?.oldValue, status?.newValue, status?.note]).toEqual(["open", "resolved", note]);
  });

  it("Q15 No → Yes creates an Open 'Callback requested' alert and the open count rises by 1", async () => {
    const ctx = await setup();
    const before = await ctx.alerts.countOpen();
    const r = await ctx.repo.editResponse(
      "r-s002",
      { ...answersOf(ctx, "r-s002"), Q15: "Yes" },
      PW,
    );
    if (!r.ok) throw new Error("edit failed");
    expect(r.value.alert?.status).toBe("open");
    expect(r.value.alert?.reasons).toEqual([{ kind: "callback" }]);
    const after = await ctx.alerts.countOpen();
    expect(before.ok && after.ok && after.value).toBe(before.ok ? before.value + 1 : -1);
    expect(auditFor(ctx, "alert.create")).toHaveLength(1);
  });
});

describe("delete and restore (US-21, G-03)", () => {
  it("delete hides the response, its alert and the count; restore returns answers and the previous alert status", async () => {
    const ctx = await setup();
    const answers = JSON.stringify(answersOf(ctx, "r-s020"));
    const countBefore = await ctx.alerts.countOpen();
    const del = await ctx.repo.deleteResponse("r-s020", PW);
    expect(del.ok).toBe(true);

    const list = await ctx.repo.listResponses(WIDE);
    expect(list.ok && list.value.some((r) => r.id === "r-s020")).toBe(false);
    const get = await ctx.repo.getResponse("r-s020");
    expect(!get.ok && get.error.code).toBe("NOT_FOUND");
    const deleted = await ctx.repo.listDeleted();
    expect(deleted.ok && deleted.value.map((d) => d.id)).toEqual(["r-s020"]);
    const alerts = await ctx.alerts.listAlerts();
    expect(alerts.ok && alerts.value.some((a) => a.responseId === "r-s020")).toBe(false);

    const res = await ctx.repo.restoreResponse("r-s020", PW);
    expect(res.ok).toBe(true);
    expect(JSON.stringify(answersOf(ctx, "r-s020"))).toBe(answers);
    const back = await ctx.repo.getResponse("r-s020");
    expect(back.ok && back.value.alert?.status).toBe("contacted");
    const countAfter = await ctx.alerts.countOpen();
    expect(countAfter).toEqual(countBefore);
    const empty = await ctx.repo.listDeleted();
    expect(empty.ok && empty.value).toEqual([]);
    expect(
      ctx.tab.store
        .read("audit")
        .map((a) => a.action)
        .filter((a) => a.startsWith("response.")),
    ).toEqual(["response.delete", "response.restore"]);
  });

  it("delete and restore with a wrong password return BAD_PASSWORD and change nothing", async () => {
    const ctx = await setup();
    const d = await ctx.repo.deleteResponse("r-s001", WRONG);
    expect(!d.ok && d.error.code).toBe("BAD_PASSWORD");
    expect(ctx.tab.store.read("responses").find((r) => r.id === "r-s001")?.deletedAt).toBeNull();
    await ctx.repo.deleteResponse("r-s001", PW);
    const r = await ctx.repo.restoreResponse("r-s001", WRONG);
    expect(!r.ok && r.error.code).toBe("BAD_PASSWORD");
    expect(
      ctx.tab.store.read("responses").find((x) => x.id === "r-s001")?.deletedAt,
    ).not.toBeNull();
  });

  it("NOT_FOUND for deleting an unknown or already-deleted response and restoring a live one", async () => {
    const ctx = await setup();
    const a = await ctx.repo.deleteResponse("r-nope", PW);
    expect(!a.ok && a.error.code).toBe("NOT_FOUND");
    const live = await ctx.repo.restoreResponse("r-s001", PW);
    expect(!live.ok && live.error.code).toBe("NOT_FOUND");
    await ctx.repo.deleteResponse("r-s001", PW);
    const twice = await ctx.repo.deleteResponse("r-s001", PW);
    expect(!twice.ok && twice.error.code).toBe("NOT_FOUND");
  });

  it("a failed delete (S-13) returns SAVE_FAILED and leaves the response live", async () => {
    const ctx = await setup();
    ctx.tab.fault.armNextWrite();
    const r = await ctx.repo.deleteResponse("r-s001", PW);
    expect(!r.ok && r.error.code).toBe("SAVE_FAILED");
    expect(ctx.tab.store.read("responses").find((x) => x.id === "r-s001")?.deletedAt).toBeNull();
  });
});

describe("roles (G-W2)", () => {
  async function everyMethod(repo: LocalResponseRepo, answers: AnswerMap) {
    return [
      await repo.listResponses(WIDE),
      await repo.getResponse("r-s001"),
      await repo.listDeleted(),
      await repo.editResponse("r-s001", answers, PW),
      await repo.deleteResponse("r-s001", PW),
      await repo.restoreResponse("r-s001", PW),
    ];
  }

  it("a support session gets FORBIDDEN from every response method and nothing changes", async () => {
    const ctx = await setup("support1");
    const before = JSON.stringify(ctx.tab.store.read("responses"));
    const results = await everyMethod(ctx.repo, answersOf(ctx, "r-s001"));
    expect(results.map((r) => !r.ok && r.error.code)).toEqual(Array<string>(6).fill("FORBIDDEN"));
    expect(JSON.stringify(ctx.tab.store.read("responses"))).toBe(before);
  });

  it("no session gets UNAUTHENTICATED from every response method", async () => {
    const ctx = await setup(null);
    const results = await everyMethod(ctx.repo, answersOf(ctx, "r-s001"));
    expect(results.map((r) => !r.ok && r.error.code)).toEqual(
      Array<string>(6).fill("UNAUTHENTICATED"),
    );
  });
});

describe("list Alert flag counts only open alerts (rework)", () => {
  const flagOf = async (ctx: Ctx, id: string) => {
    const rows = value(await ctx.repo.listResponses(WIDE));
    return rows.find((r) => r.id === id)?.hasAlert;
  };

  it("false for a contacted alert, true once open, false again once resolved", async () => {
    const ctx = await setup();
    expect(await flagOf(ctx, "r-s020")).toBe(false);
    const base = answersOf(ctx, "r-s001");
    value(await ctx.repo.editResponse("r-s001", { ...base, Q12: 1 }, PW));
    expect(await flagOf(ctx, "r-s001")).toBe(true);
    value(await ctx.repo.editResponse("r-s001", { ...base, Q12: 4 }, PW));
    expect(await flagOf(ctx, "r-s001")).toBe(false);
  });
});
