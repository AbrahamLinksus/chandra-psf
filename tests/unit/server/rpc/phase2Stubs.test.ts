// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { RequestCtx } from "@/server/ctx";
import { createServerDataAccess } from "@/server/createServerDataAccess";

vi.mock("server-only", () => ({}));

describe("branches, advisors and customers are stubbed on the server (T-01b)", () => {
  const da = createServerDataAccess({} as RequestCtx);

  it.each([
    ["branches.listBranches", () => da.branches.listBranches()],
    ["advisors.listAdvisors", () => da.advisors.listAdvisors({})],
    ["customers.searchCustomers", () => da.customers.searchCustomers({ phone: "1" })],
  ])("%s answers UNAVAILABLE", async (_name, call) => {
    const r = await call();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("UNAVAILABLE");
  });
});
