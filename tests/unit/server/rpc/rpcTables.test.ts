// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createServerDataAccess } from "@/server/createServerDataAccess";
import { rpcTables } from "@/server/rpc";
import type { RequestCtx } from "@/server/ctx";

vi.mock("server-only", () => ({}));

describe("RPC method tables", () => {
  it("list only methods that exist on the matching server repo", () => {
    const access = createServerDataAccess({} as RequestCtx) as unknown as Record<string, object>;
    for (const [repo, table] of Object.entries(rpcTables)) {
      for (const method of Object.keys(table)) {
        const fn = (access[repo] as Record<string, unknown>)[method];
        expect(typeof fn, `${repo}.${method}`).toBe("function");
      }
    }
  });
});
