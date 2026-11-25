// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createServerDataAccess } from "@/server/createServerDataAccess";
import { makeServerCtx } from "../../../support/serverCtx";

vi.mock("server-only", () => ({}));

describe("erase is wired to the real repo (T-25 landed it)", () => {
  it("customers.eraseCustomers is no longer UNAVAILABLE: a signed-out caller is refused", async () => {
    const env = await makeServerCtx();
    try {
      const da = createServerDataAccess(env.ctx);
      const r = await da.customers.eraseCustomers(["x"], { password: "p" });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe("UNAUTHENTICATED");
    } finally {
      await env.client.close();
    }
  });
});
