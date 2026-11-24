// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { responses } from "@/server/db/schema";
import { MutableClock, makeServerCtx } from "../../../support/serverCtx";
import { happyAnswers, seedLink } from "./harness";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: () => undefined }));

const state = vi.hoisted(() => ({ db: { current: null as object | null } }));
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: () => undefined, set: () => undefined }),
}));
vi.mock("@/server/db/client", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  getDb: () => Promise.resolve(state.db.current),
}));
vi.mock("@/server/env", () => ({
  getServerEnv: () => ({ DATABASE_URL: "pglite:memory", IP_HASH_PEPPER: "p".repeat(40) }),
}));

const { handleRpc } = await import("@/server/rpc/handler");

type Env = Awaited<ReturnType<typeof makeServerCtx>>;
let env: Env;

beforeEach(async () => {
  env = await makeServerCtx();
  state.db.current = env.db;
});
afterEach(async () => {
  await env.client.close();
});

function submit(ip: string, code: string, subId: string): Promise<Response> {
  const headers = new Headers({
    host: "app.test",
    origin: "http://app.test",
    "content-type": "application/json",
    "x-forwarded-for": ip,
  });
  const body = JSON.stringify({ args: [code, happyAnswers({ Q12: 5, Q15: "No" }), subId] });
  return handleRpc(new Request("http://app.test/api/rpc", { method: "POST", headers, body }), {
    repo: "feedback",
    method: "submitResponse",
  });
}

describe("45 submits from one address in an hour (S-22)", () => {
  it("all 45 different links are accepted and stored", async () => {
    const clock = new MutableClock(new Date());
    const links = [];
    for (let i = 0; i < 45; i++) {
      links.push(await seedLink(env.db, { no: `JC-45-${String(i)}`, now: clock.now() }));
    }
    for (const [i, l] of links.entries()) {
      const id = `00000000-0000-4000-8000-${i.toString().padStart(12, "0")}`;
      const res = await submit("198.51.100.77", l.code, id);
      expect(await res.json()).toEqual({ ok: true, value: { callbackRequested: false } });
    }
    expect(await env.db.select().from(responses)).toHaveLength(45);
  }, 120_000);
});
