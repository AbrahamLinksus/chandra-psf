import { describe, expect, it } from "vitest";
import { dateOf } from "@/hooks/useFiltersFromUrl";

describe("dateOf", () => {
  it("accepts a valid date", () => {
    expect(dateOf("2026-03-15")).toBe("2026-03-15");
  });
  it("accepts a leap day", () => {
    expect(dateOf("2024-02-29")).toBe("2024-02-29");
  });
  it("rejects an impossible month and day", () => {
    expect(dateOf("2026-13-45")).toBeNull();
  });
  it("rejects a day past month end", () => {
    expect(dateOf("2026-02-30")).toBeNull();
  });
  it("rejects a non-leap Feb 29", () => {
    expect(dateOf("2026-02-29")).toBeNull();
  });
  it("rejects malformed strings and null", () => {
    expect(dateOf("2026/03/15")).toBeNull();
    expect(dateOf("abc")).toBeNull();
    expect(dateOf(null)).toBeNull();
  });
});
