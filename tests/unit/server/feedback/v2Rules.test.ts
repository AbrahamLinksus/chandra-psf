// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { alerts, responses } from "@/server/db/schema";
import { makeServerCtx, must } from "../../../support/serverCtx";
import { calmAnswers, happyAnswers, seedLink } from "./harness";

vi.mock("server-only", () => ({}));

const { ServerFeedbackRepo } = await import("@/server/repos/feedback");

type Env = Awaited<ReturnType<typeof makeServerCtx>>;
let env: Env;
const NOW = new Date("2026-11-24T06:30:00.000Z");
const SUB = "11111111-1111-4111-8111-111111111111";

beforeEach(async () => {
  env = await makeServerCtx();
  env.clock.at = NOW;
});
afterEach(async () => {
  await env.client.close();
});

const repo = () => new ServerFeedbackRepo(env.ctx);
const link = () => seedLink(env.db, { no: "JC-24-1042", now: NOW });
const storedAnswers = async () =>
  must((await env.db.select().from(responses))[0]).answers as Record<string, unknown>;

describe("submitResponse v2 rules (SPEC F-3, F-4)", () => {
  it("the server rejects v1 codes, hidden follow-ups and a missing required follow-up", async () => {
    const s = await link();
    const cases: [string, Record<string, unknown>][] = [
      ["v1 code Q12", { Q12: 3 }],
      ["v1 comments Q14", { Q14: "hello" }],
      ["hidden Q3a (Q3 = No)", { Q3a: { options: ["Brakes"] } }],
      ["hidden Q10a (Q10 = No)", { Q10: "No", Q10a: "Morning (9 AM–12 PM)" }],
      ["Q2 = No without Q2a", { Q2: "No" }],
      ["Q1 = 2 without Q1a", { Q1: 2, Q1a: undefined }],
      ["Q10 = Yes without Q10a", { Q10a: undefined }],
      ["Q9 = No without Q9a", { Q9: "No", Q9a: undefined }],
      ["Q10a not a slot", { Q10a: "Midnight" }],
    ];
    for (const [name, over] of cases) {
      env.clock.advance(3_600_000); // a fresh rate-limit hour per case
      const r = await repo().submitResponse(s.code, happyAnswers(over), SUB);
      expect(r, name).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    }
    expect(await env.db.select().from(responses)).toHaveLength(0);
  });

  it("Q1 = 2 alone or Q3 = Yes alone creates no alert; Q3a is stored", async () => {
    const s = await link();
    const a = calmAnswers({
      Q1: 2,
      Q1a: { options: ["Other"] },
      Q3: "Yes",
      Q3a: { options: ["Brakes"] },
    });
    const r = await repo().submitResponse(s.code, a, SUB);
    expect(r).toEqual({ ok: true, value: { callbackRequested: false } });
    expect(await env.db.select().from(alerts)).toHaveLength(0);
    expect(await storedAnswers()).toMatchObject({ Q3: "Yes", Q3a: { options: ["Brakes"] } });
  });
});
