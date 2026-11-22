import { describe, expect, it } from "vitest";
import { formatAuditValue, TRUNCATE_AT, truncate } from "@/features/admin-audit/auditFormat";

describe("formatAuditValue", () => {
  it("null or undefined → dash", () => {
    expect(formatAuditValue(null)).toBe("—");
    expect(formatAuditValue(undefined)).toBe("—");
  });
  it("string → itself", () => {
    expect(formatAuditValue("open")).toBe("open");
  });
  it("object → JSON text", () => {
    expect(formatAuditValue({ status: "open" })).toBe('{"status":"open"}');
  });
});

describe("truncate", () => {
  it("short text → unchanged", () => {
    expect(truncate("abc")).toBe("abc");
  });
  it("text over the limit → cut with ellipsis", () => {
    const out = truncate("x".repeat(TRUNCATE_AT + 10));
    expect(out).toBe(`${"x".repeat(TRUNCATE_AT)}…`);
  });
});
