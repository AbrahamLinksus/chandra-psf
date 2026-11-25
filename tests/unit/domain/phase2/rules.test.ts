import { describe, expect, it } from "vitest";
import { stripFreeText } from "@/domain/erasure";
import { jobCardInputSchema } from "@/domain/jobCardInput";
import { passwordProblem } from "@/domain/passwordPolicy";
import { retentionCutoffs, retentionDueDate } from "@/domain/retention";
import { isAdmin, isMainAdmin } from "@/domain/roles";
import type { AnswerMap } from "@/domain/types";

const NOW = new Date("2026-11-22T06:30:00.000Z");
const VALID = {
  jobCardNo: "JC-24-1042",
  customerName: "Ramesh Kumar",
  phone: "98400 12345",
  regNo: "tn09bx4521",
  model: "Activa 6G",
  serviceType: "Paid service",
  serviceDate: "2026-11-14",
  advisorId: "adv-1",
};

function parse(over: Record<string, unknown>) {
  return jobCardInputSchema(NOW).safeParse({ ...VALID, ...over });
}
function messages(over: Record<string, unknown>): string[] {
  const r = parse(over);
  return r.success ? [] : r.error.issues.map((i) => i.message);
}

describe("jobCardInputSchema", () => {
  it("SPEC §5 row → normalises reg. no, phone and vehicle type", () => {
    const r = parse({});
    expect(r.success && r.data).toMatchObject({
      regNo: "TN 09 BX 4521",
      phone: "+91 98400 12345",
      vehicleType: "scooter",
    });
  });
  it("blank phone → null", () => {
    const r = parse({ phone: "" });
    expect(r.success && r.data.phone).toBeNull();
  });
  it("landline phone → rejected", () => {
    expect(messages({ phone: "044 2345 6789" })).toContain("Enter a valid Indian mobile number");
  });
});

describe("jobCardInputSchema service date and model", () => {
  it("25 Nov entered on 22 Nov → future message", () => {
    expect(messages({ serviceDate: "2026-11-25" })).toEqual([
      "Service date can't be in the future",
    ]);
  });
  it("today and exactly 60 days ago → accepted", () => {
    expect(parse({ serviceDate: "2026-11-22" }).success).toBe(true);
    expect(parse({ serviceDate: "2026-09-23" }).success).toBe(true);
  });
  it("61 days ago → rejected", () => {
    expect(parse({ serviceDate: "2026-09-22" }).success).toBe(false);
  });
  it("impossible date → rejected without throwing", () => {
    expect(parse({ serviceDate: "2026-13-45" }).success).toBe(false);
  });
  it("model Other without name and vehicle type → both flagged", () => {
    const r = jobCardInputSchema(NOW).safeParse({ ...VALID, model: "Other" });
    expect(r.success ? [] : r.error.issues.map((i) => i.path[0])).toEqual([
      "modelOther",
      "vehicleType",
    ]);
  });
  it("model Other with name and vehicle type → accepted", () => {
    const r = parse({ model: "Other", modelOther: "Hero Splendor", vehicleType: "motorcycle" });
    expect(r.success && r.data.vehicleType).toBe("motorcycle");
  });
  it("short job card number, long name, short reg. no → rejected", () => {
    expect(parse({ jobCardNo: "ab" }).success).toBe(false);
    expect(parse({ customerName: "x".repeat(81) }).success).toBe(false);
    expect(parse({ regNo: "AB-12" }).success).toBe(false);
  });
});

describe("passwordProblem", () => {
  it("under 8 characters → too_short", () => {
    expect(passwordProblem("abc123")).toBe("too_short");
  });
  it("common password in any case → too_common", () => {
    expect(passwordProblem("PassWord123")).toBe("too_common");
  });
  it("unusual password → null", () => {
    expect(passwordProblem("violet-kettle-9Q")).toBeNull();
  });
});

describe("roles", () => {
  it("isAdmin and isMainAdmin are right for the three roles", () => {
    expect([isAdmin("support"), isAdmin("branch_admin"), isAdmin("main_admin")]).toEqual([
      false,
      true,
      true,
    ]);
    expect([
      isMainAdmin("support"),
      isMainAdmin("branch_admin"),
      isMainAdmin("main_admin"),
    ]).toEqual([false, false, true]);
  });
});

describe("retention", () => {
  it("unanswered visit served 14 Nov 2026 → due 12 Feb 2027", () => {
    expect(retentionDueDate("2026-11-14", false)).toBe("2027-02-12");
  });
  it("answered visit served 14 Nov 2026 → due 14 Nov 2029", () => {
    expect(retentionDueDate("2026-11-14", true)).toBe("2029-11-14");
  });
  it("29 Feb service date → answered due 28 Feb three years later", () => {
    expect(retentionDueDate("2028-02-29", true)).toBe("2031-02-28");
  });
  it("cut-offs use the IST date, so 21:00 UTC is already the next day", () => {
    const c = retentionCutoffs(new Date("2027-02-11T21:00:00.000Z"));
    expect(c.unansweredOn).toBe("2026-11-14");
    expect(c.answeredOn).toBe("2024-02-12");
    expect(c.deletedBefore).toBe("2027-01-12T21:00:00.000Z");
  });
});

describe("stripFreeText", () => {
  it("drops Q2a and every .text; keeps ratings, chosen options and Q10a", () => {
    const answers: AnswerMap = {
      Q1: 2,
      Q1a: { options: ["Other"], text: "ramesh called me" },
      Q2: "No",
      Q2a: "Brake still weak, call 98400 12345",
      Q9: "Yes",
      Q9a: "Staff Behaviour",
      Q10: "Yes",
      Q10a: "Evening (3 PM–6 PM)",
    };
    expect(stripFreeText(answers)).toEqual({
      Q1: 2,
      Q1a: { options: ["Other"] },
      Q2: "No",
      Q9: "Yes",
      Q9a: "Staff Behaviour",
      Q10: "Yes",
      Q10a: "Evening (3 PM–6 PM)",
    });
  });
});
