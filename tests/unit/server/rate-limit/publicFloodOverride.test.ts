// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeServerCtx } from "../../../support/serverCtx";

vi.mock("server-only", () => ({}));

const { hitIpLimit, PUBLIC_FLOOD_BUCKET } = await import("@/server/rateLimit");

type Env = Awaited<ReturnType<typeof makeServerCtx>>;
let env: Env;

beforeEach(async () => {
  env = await makeServerCtx();
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await env.client.close();
});

/** Hits the bucket `hits` times against a limit of 2; returns the last answer. */
async function lastAnswer(bucket: string, hits: number): Promise<boolean> {
  let ok = true;
  for (let i = 0; i < hits; i++) ok = await hitIpLimit(env.ctx, { bucket, limit: 2 });
  return ok;
}

describe("PUBLIC_FLOOD_LIMIT_OVERRIDE", () => {
  it("is honoured on the public bucket outside production", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("PUBLIC_FLOOD_LIMIT_OVERRIDE", "5");
    expect(await lastAnswer(PUBLIC_FLOOD_BUCKET, 5)).toBe(true);
    expect(await lastAnswer(PUBLIC_FLOOD_BUCKET, 1)).toBe(false);
  });

  it("is honoured in production when the database is pglite (e2e server)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "pglite:memory");
    vi.stubEnv("PUBLIC_FLOOD_LIMIT_OVERRIDE", "5");
    expect(await lastAnswer(PUBLIC_FLOOD_BUCKET, 5)).toBe(true);
  });

  it.each(["abc", "0", "-3", "2.5", ""])("is ignored when invalid (%j)", async (value) => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("PUBLIC_FLOOD_LIMIT_OVERRIDE", value);
    expect(await lastAnswer(PUBLIC_FLOOD_BUCKET, 3)).toBe(false);
  });

  it("does not raise limits of other buckets", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("PUBLIC_FLOOD_LIMIT_OVERRIDE", "5");
    expect(await lastAnswer("sign_in", 3)).toBe(false);
  });

  it("is ignored in production with a non-pglite database", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "postgres://u:p@db.example.com/app");
    vi.stubEnv("PUBLIC_FLOOD_LIMIT_OVERRIDE", "5");
    expect(await lastAnswer(PUBLIC_FLOOD_BUCKET, 3)).toBe(false);
  });
});
