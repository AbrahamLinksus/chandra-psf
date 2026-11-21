import { describe, expect, it } from "vitest";
import { fromAnswerRows, toAnswerRows } from "@/domain/answers";
import { AnswerMapSchema } from "@/domain/schemas";
import {
  addDays,
  daysBetween,
  formatIST,
  formatISTDate,
  istDateOf,
  istToISOTime,
} from "@/domain/time";
import type { AnswerMap, Visit } from "@/domain/types";
import { visitStatus } from "@/domain/visitStatus";

const NOW = new Date("2026-03-10T06:30:00.000Z");
const visit = (over: Partial<Visit>): Visit => ({
  id: "v",
  jobCardNo: "JC-24-1042",
  phone: null,
  token: "t",
  createdBy: "u-support1",
  createdAt: "2026-03-08T06:30:00.000Z",
  expiresAt: "2026-03-15T06:30:00.000Z",
  openedAt: null,
  completedAt: null,
  cancelledAt: null,
  replacedBy: null,
  ...over,
});

describe("visitStatus", () => {
  it("precedence cancelled > completed > expired > opened > created", () => {
    const at = "2026-03-09T00:00:00.000Z";
    expect(visitStatus(visit({ cancelledAt: at, completedAt: at }), NOW)).toBe("cancelled");
    expect(visitStatus(visit({ completedAt: at, replacedBy: "v2" }), NOW)).toBe("completed");
    expect(visitStatus(visit({ replacedBy: "v2" }), NOW)).toBe("expired");
    expect(visitStatus(visit({ expiresAt: "2026-03-09T00:00:00.000Z" }), NOW)).toBe("expired");
    expect(visitStatus(visit({ openedAt: at }), NOW)).toBe("opened");
    expect(visitStatus(visit({}), NOW)).toBe("created");
  });
});

describe("answers rows", () => {
  it("round-trips numbers, strings and option answers with and without text", () => {
    const map: AnswerMap = {
      Q1: 4,
      Q2: "Yes",
      Q1a: { options: ["Other"], text: "late" },
      Q3a: { options: ["Engine"] },
    };
    expect(fromAnswerRows(toAnswerRows(map))).toEqual(map);
  });

  it("a row with no value is dropped", () => {
    expect(
      fromAnswerRows([{ code: "Q1", valueNum: null, valueText: null, valueOptions: null }]),
    ).toEqual({});
  });

  it("AnswerMapSchema accepts valid maps and rejects bad codes and arrays", () => {
    expect(AnswerMapSchema.safeParse({ Q1: 3, Q1a: { options: [] } }).success).toBe(true);
    expect(AnswerMapSchema.safeParse({ X1: 3 }).success).toBe(false);
    expect(AnswerMapSchema.safeParse([]).success).toBe(false);
    expect(AnswerMapSchema.safeParse(null).success).toBe(false);
  });
});

describe("IST time helpers", () => {
  it("istDateOf uses the IST day (18:30 UTC is already next day)", () => {
    expect(istDateOf("2026-03-10T18:30:00.000Z")).toBe("2026-03-11");
    expect(istDateOf(new Date("2026-03-10T06:30:00.000Z"))).toBe("2026-03-10");
  });

  it("addDays and daysBetween", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysBetween("2026-03-01", "2026-03-11")).toBe(10);
  });

  it("istToISOTime converts minutes after IST midnight to UTC", () => {
    expect(istToISOTime("2026-03-10", 600)).toBe("2026-03-10T04:30:00.000Z");
  });

  it("formats dates for display", () => {
    expect(formatISTDate("2026-11-14")).toBe("14 Nov");
    expect(formatISTDate("2026-11-14", { year: true })).toBe("14 Nov 2026");
    expect(formatIST("2026-11-14T10:00:00.000Z")).toMatch(/14 Nov 2026/);
  });
});
