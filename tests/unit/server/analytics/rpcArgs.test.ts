// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { analyticsRpc } = await import("@/server/rpc/analytics");

describe("analytics RPC arguments (what the browser really sends)", () => {
  it("S-30 / getFilterOptions accepts the call the Overview makes with no branch (undefined travels as null)", () => {
    // useOverview calls getFilterOptions(undefined); JSON.stringify turns [undefined] into [null].
    const sent = JSON.parse(JSON.stringify([undefined])) as unknown;
    expect(analyticsRpc.getFilterOptions.input.safeParse(sent).success).toBe(true);
  });

  it("getFilterOptions accepts no argument and a branch id", () => {
    expect(analyticsRpc.getFilterOptions.input.safeParse([]).success).toBe(true);
    expect(analyticsRpc.getFilterOptions.input.safeParse([{ branchId: "b1" }]).success).toBe(true);
  });
});
