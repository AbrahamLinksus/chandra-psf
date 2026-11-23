// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { rateLimits, sessions } from "@/server/db/schema";
import { createSession, hashToken } from "@/server/auth/session";
import { hashIp, hitIpLimit, PUBLIC_FLOOD_BUCKET } from "@/server/rateLimit";
import {
  MutableClock,
  makeServerCtx,
  must,
  seedBranch,
  seedUser,
} from "../../../support/serverCtx";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: () => undefined }));

const state = vi.hoisted(() => ({
  db: { current: null as object | null },
  cookie: undefined as string | undefined,
  pepper: undefined as string | undefined,
}));
vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      get: (n: string) =>
        n === "psf_session" && state.cookie ? { value: state.cookie } : undefined,
      set: () => undefined,
    }),
}));
vi.mock("@/server/db/client", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  getDb: () => Promise.resolve(state.db.current),
}));
vi.mock("@/server/env", () => ({
  getServerEnv: () => ({ DATABASE_URL: "pglite:memory", IP_HASH_PEPPER: state.pepper }),
}));

const { handleRpc } = await import("@/server/rpc/handler");

type Env = Awaited<ReturnType<typeof makeServerCtx>>;
let env: Env;

beforeEach(async () => {
  env = await makeServerCtx();
  state.db.current = env.db;
  state.cookie = undefined;
  state.pepper = "p".repeat(40);
});
afterEach(async () => {
  await env.client.close();
});

interface CallOpts {
  args?: unknown;
  origin?: string | null;
  ct?: string;
  active?: boolean;
  ip?: string;
  raw?: string;
}

function call(repo: string, method: string, o: CallOpts = {}): Promise<Response> {
  const headers = new Headers({ host: "app.test", "content-type": o.ct ?? "application/json" });
  if (o.origin !== null) headers.set("origin", o.origin ?? "http://app.test");
  if (o.active !== undefined) headers.set("x-psf-active", o.active ? "1" : "0");
  headers.set("x-forwarded-for", o.ip ?? "203.0.113.7");
  const body = o.raw ?? JSON.stringify({ args: o.args ?? [] });
  return handleRpc(new Request("http://app.test/api/rpc", { method: "POST", headers, body }), {
    repo,
    method,
  });
}

async function signedIn(): Promise<void> {
  const branchId = await seedBranch(env.db, "Velachery");
  const uid = await seedUser(env.db, { role: "support", branchId });
  const clock = new MutableClock(new Date(Date.now() - 5 * 60_000));
  await createSession({ db: env.db, clock, cookies: env.cookies }, uid);
  state.cookie = must(env.cookies.value);
}

async function lastActive(): Promise<number> {
  const [row] = await env.db
    .select()
    .from(sessions)
    .where(eq(sessions.idHash, hashToken(must(state.cookie))));
  return must(row).lastActiveAt.getTime();
}

describe("RPC door replies", () => {
  it("rejects a foreign Origin with 403 and no-store", async () => {
    const res = await call("auth", "currentUser", { origin: "http://evil.test" });
    expect(res.status).toBe(403);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("rejects a missing Origin and a non-JSON content type with 403", async () => {
    expect((await call("auth", "currentUser", { origin: null })).status).toBe(403);
    expect((await call("auth", "currentUser", { ct: "text/plain" })).status).toBe(403);
  });
});

describe("RPC door lookups and args", () => {
  it("returns 404 for an unknown repo or method, including prototype names", async () => {
    const cases = [
      ["nope", "x"],
      ["auth", "nope"],
      ["constructor", "x"],
      ["auth", "toString"],
    ] as const;
    for (const [r, m] of cases) {
      const res = await call(r, m);
      expect(res.status).toBe(404);
      expect(res.headers.get("Cache-Control")).toBe("no-store");
    }
  });

  it("returns VALIDATION for bad args and for an unparseable body", async () => {
    for (const res of [
      await call("auth", "signIn", { args: [1, 2] }),
      await call("auth", "signIn", { raw: "not json" }),
    ]) {
      expect(res.status).toBe(200);
      expect(res.headers.get("Cache-Control")).toBe("no-store");
      const body = (await res.json()) as { ok: boolean; error: { code: string } };
      expect(body.error.code).toBe("VALIDATION");
    }
  });

  it("returns UNAUTHENTICATED for a staff method without a session", async () => {
    const res = await call("jobCards", "listFreshJobCards");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toMatchObject({ ok: false, error: { code: "UNAUTHENTICATED" } });
  });

  it("returns UNAVAILABLE for a stub method (public, and staff with a session)", async () => {
    expect(await (await call("auth", "currentUser")).json()).toMatchObject({
      error: { code: "UNAVAILABLE" },
    });
    await signedIn();
    const res = await call("jobCards", "listFreshJobCards");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toMatchObject({ error: { code: "UNAVAILABLE" } });
  });
});

describe("session touch", () => {
  it("does not touch on a read without x-psf-active", async () => {
    await signedIn();
    const before = await lastActive();
    await call("jobCards", "listFreshJobCards", { active: false });
    await call("jobCards", "listFreshJobCards");
    expect(await lastActive()).toBe(before);
  });

  it("touches on a read with x-psf-active: 1", async () => {
    await signedIn();
    const before = await lastActive();
    await call("jobCards", "listFreshJobCards", { active: true });
    expect(await lastActive()).toBeGreaterThan(before);
  });

  it("touches on a write even when the tab is not active", async () => {
    await signedIn();
    const before = await lastActive();
    await call("auth", "setOwnPassword", { args: ["x"], active: false });
    expect(await lastActive()).toBeGreaterThan(before);
  });
});

describe("per-IP flood limit and HMAC-only storage", () => {
  it("allows 300 public calls an hour and returns RATE_LIMITED on the 301st", async () => {
    const ip = "198.51.100.9";
    const windowStart = new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000);
    await env.db
      .insert(rateLimits)
      .values({ bucket: PUBLIC_FLOOD_BUCKET, key: hashIp(ip), windowStart, count: 299 });
    const ok: unknown = await (await call("auth", "currentUser", { ip })).json();
    expect(ok).toMatchObject({ error: { code: "UNAVAILABLE" } });
    const res = await call("auth", "currentUser", { ip });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toMatchObject({ ok: false, error: { code: "RATE_LIMITED" } });
    const other = await call("auth", "currentUser", { ip: "198.51.100.10" });
    expect(await other.json()).toMatchObject({ error: { code: "UNAVAILABLE" } });
  });
});

describe("flood limit storage", () => {
  it("does not count staff methods against the public flood limit", async () => {
    await call("jobCards", "listFreshJobCards");
    expect(await env.db.select().from(rateLimits)).toHaveLength(0);
  });

  it("stores only the HMAC of the IP, keyed by IP_HASH_PEPPER", async () => {
    const ip = "192.0.2.55";
    await hitIpLimit({ db: env.db, clock: env.clock, ip }, { bucket: "b", limit: 3 });
    const rows = await env.db.select().from(rateLimits);
    const row = must(rows[0]);
    expect(row.key).toHaveLength(32);
    expect(row.key.equals(hashIp(ip))).toBe(true);
    expect(row.key.toString("utf8")).not.toContain(ip);
    state.pepper = "q".repeat(40);
    expect(hashIp(ip).equals(row.key)).toBe(false);
  });

  it("counts a window and rejects past the limit; a new window resets", async () => {
    const ctx = { db: env.db, clock: env.clock, ip: "192.0.2.1" };
    const spec = { bucket: "b", limit: 2, windowMs: 1000 };
    expect(await hitIpLimit(ctx, spec)).toBe(true);
    expect(await hitIpLimit(ctx, spec)).toBe(true);
    expect(await hitIpLimit(ctx, spec)).toBe(false);
    env.clock.advance(5000);
    expect(await hitIpLimit(ctx, spec)).toBe(true);
  });

  it("falls back to a process pepper when IP_HASH_PEPPER is unset (stable within the process)", () => {
    state.pepper = undefined;
    expect(hashIp("1.2.3.4").equals(hashIp("1.2.3.4"))).toBe(true);
  });
});
