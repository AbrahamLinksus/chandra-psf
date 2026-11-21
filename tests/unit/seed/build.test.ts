import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import seedJson from "@/data/seed/seed.json";
import { SeedSchema, type Seed } from "@/domain/schemas";
import { readSurveyRows, toAnswers } from "../../../scripts/seed/answers";
import { buildFromRows, buildSeed, serialize } from "../../../scripts/build-seed";

const ROOT = path.resolve(__dirname, "../../..");
const SEED_PATH = path.join(ROOT, "src/data/seed/seed.json");
const XLSX = path.join(ROOT, "data/seed/Honda_PSF_Survey_30_Dummy_Customer_Responses.xlsx");
let built: Seed;

beforeAll(async () => {
  built = await buildSeed();
});

describe("pnpm seed build (S-07)", () => {
  it("is deterministic and matches the committed seed.json (what --check compares)", async () => {
    const again = await buildSeed();
    expect(serialize(again)).toBe(serialize(built));
    expect(readFileSync(SEED_PATH, "utf8")).toBe(serialize(built));
  });

  it("buildFromRows is a pure function of its rows", async () => {
    const rows = await readSurveyRows(XLSX);
    expect(serialize(buildFromRows(rows))).toBe(serialize(buildFromRows(rows)));
  });

  it("the committed file passes the seed schema", () => {
    expect(() => SeedSchema.parse(seedJson)).not.toThrow();
  });

  it("has about 33 responses: the 30 xlsx rows plus 3 extra", () => {
    expect(built.responses).toHaveLength(33);
  });

  it("has 2 or 3 extra responses carrying a rating of 1", async () => {
    const hasOne = (a: Record<string, unknown>) => ["Q1", "Q6", "Q11"].some((q) => a[q] === 1);
    const fromXlsx = (await readSurveyRows(XLSX)).filter((r) => hasOne(toAnswers(r))).length;
    const extras = built.responses.filter((r) => hasOne(r.answers)).length - fromXlsx;
    expect(extras).toBeGreaterThanOrEqual(2);
    expect(extras).toBeLessThanOrEqual(3);
  });

  it("has 4 advisors and 5 models", () => {
    expect(built.advisors).toHaveLength(4);
    expect(new Set(built.jobCards.map((j) => j.model)).size).toBe(5);
  });

  it("has 3 users: 1 admin and 2 support, none needing a password change", () => {
    expect(built.users.map((u) => u.role).sort()).toEqual(["admin", "support", "support"]);
    expect(built.users.every((u) => u.active && !u.mustSetPassword)).toBe(true);
  });
});

describe("seed answer rules", () => {
  const base = { sampleId: "CUST-001", customer: "x" };

  it("Q11 is converted with ceil(x/2) (1-10 becomes 1-5)", () => {
    const q11 = (x: number) => toAnswers({ ...base, answers: { Q11: x } }).Q11;
    expect([1, 2, 3, 4, 9, 10].map(q11)).toEqual([1, 1, 2, 2, 5, 5]);
  });

  it("Q15 is Yes only on CUST-006, CUST-014 and CUST-022", async () => {
    const rows = await readSurveyRows(XLSX);
    const yes = rows.filter((r) => toAnswers(r).Q15 === "Yes").map((r) => r.sampleId);
    expect(yes.sort()).toEqual(["CUST-006", "CUST-014", "CUST-022"]);
    expect(built.responses.filter((r) => r.answers.Q15 === "Yes")).toHaveLength(3);
  });

  it("a low Q1 gets a Q1a follow-up chosen from the other answers", () => {
    const q1a = (answers: Parameters<typeof toAnswers>[0]["answers"]) =>
      toAnswers({ ...base, answers }).Q1a;
    expect(q1a({ Q1: 2, Q2: "No" })).toEqual({ options: ["Problem not fixed"] });
    expect(q1a({ Q1: 2, Q2: "Partially" })).toEqual({ options: ["Same problem came back"] });
    expect(q1a({ Q1: 2, Q2: "Yes", Q3: "Yes" })).toEqual({ options: ["New problem appeared"] });
    expect(q1a({ Q1: 2, Q2: "Yes", Q3: "No", Q14: "note" })).toEqual({
      options: ["Other"],
      text: "note",
    });
  });
});

describe("seed visits and job cards", () => {
  const unanswered = () =>
    built.visits.filter((v) => !built.responses.some((r) => r.visitId === v.id));

  it("has 10 unanswered visits, some expired (older than 7 days) and some still open", () => {
    const open = unanswered();
    expect(open).toHaveLength(10);
    expect(open.filter((v) => v.expiresAt.dayOffset < 0).length).toBeGreaterThanOrEqual(3);
    expect(open.filter((v) => v.expiresAt.dayOffset >= 0).length).toBeGreaterThanOrEqual(3);
    expect(open.some((v) => v.openedAt !== null)).toBe(true);
    expect(open.some((v) => v.openedAt === null)).toBe(true);
  });

  it("has about 10 job cards with no visit, including JC-24-1042 (Ramesh Kumar)", () => {
    const without = built.jobCards.filter(
      (j) => !built.visits.some((v) => v.jobCardNo === j.jobCardNo),
    );
    expect(without).toHaveLength(10);
    expect(without.find((j) => j.jobCardNo === "JC-24-1042")?.customerName).toBe("Ramesh Kumar");
  });

  it("job card numbers are unique and every visit points at a card", () => {
    const nos = built.jobCards.map((j) => j.jobCardNo);
    expect(new Set(nos).size).toBe(nos.length);
    expect(built.visits.every((v) => nos.includes(v.jobCardNo))).toBe(true);
  });
});
