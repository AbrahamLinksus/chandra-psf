// @vitest-environment node
import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "@/server/csv";

describe("csv writer (F-10)", () => {
  it.each(["=1+1", "+91", "-5", "@SUM(A1)", "\tx", "\rx"])("prefixes %j with '", (v) => {
    expect(csvCell(v).replace(/^"|"$/g, "")).toMatch(/^'/);
  });

  it("quotes commas, quotes and newlines; leaves plain text and empties alone", () => {
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell("x\ny")).toBe('"x\ny"');
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    expect(csvCell(5)).toBe("5");
  });

  it("starts with a UTF-8 BOM, uses CRLF and keeps non-ASCII", () => {
    const out = toCsv([
      ["a", "தமிழ்"],
      ["b", "=x"],
    ]);
    expect(out).toBe("﻿a,தமிழ்\r\nb,'=x\r\n");
  });
});
