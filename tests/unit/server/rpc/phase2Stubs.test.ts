// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { RequestCtx } from "@/server/ctx";
import { createServerDataAccess } from "@/server/createServerDataAccess";

vi.mock("server-only", () => ({}));

describe("erase is still stubbed on the server (T-25 lands it)", () => {
  const da = createServerDataAccess({} as RequestCtx);

  it("customers.eraseCustomers answers UNAVAILABLE", async () => {
    const r = await da.customers.eraseCustomers(["x"], {} as never);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("UNAVAILABLE");
  });
});
