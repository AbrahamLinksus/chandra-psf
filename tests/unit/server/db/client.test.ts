// @vitest-environment node
import { branches } from "@/server/db/schema";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: () => undefined }));

function mockFailingFirstMigrate() {
  const calls = { n: 0 };
  vi.doMock("drizzle-orm/pglite/migrator", async (orig) => {
    const real = await orig<typeof import("drizzle-orm/pglite/migrator")>();
    return {
      ...real,
      migrate: (...args: Parameters<typeof real.migrate>) => {
        calls.n += 1;
        if (calls.n === 1) return Promise.reject(new Error("boom"));
        return real.migrate(...args);
      },
    };
  });
  return calls;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock("drizzle-orm/pglite/migrator");
  vi.resetModules();
});

describe("getDb", () => {
  it("returns a migrated in-memory PGlite for pglite:memory, cached per process", async () => {
    vi.stubEnv("DATABASE_URL", "pglite:memory");
    const { getDb, withTx } = await import("@/server/db/client");
    const db = await getDb();
    expect(await getDb()).toBe(db);
    const rows = await withTx(db, (tx) => tx.select().from(branches));
    expect(rows).toEqual([]);
    // PGlite boot + full migration is ~2.6 s alone but exceeded the 5 s default
    // (8.5 s) under parallel coverage load; 30 s keeps the assertions intact.
  }, 30_000);
});

describe("getDb failure and Neon paths", () => {
  it("does not cache a failed PGlite start", async () => {
    vi.stubEnv("DATABASE_URL", "pglite:memory");
    vi.resetModules();
    const calls = mockFailingFirstMigrate();
    const { getDb } = await import("@/server/db/client");
    await expect(getDb()).rejects.toThrow("boom");
    await expect(getDb()).resolves.toBeDefined();
    expect(calls.n).toBe(2);
    // Boots PGlite twice (failed migrate, then a full one): same load as above.
  }, 30_000);

  it("uses a Neon pool for a postgres URL and closes it after the request", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://u:p@h.example/db");
    vi.resetModules();
    const end = vi.fn(() => Promise.resolve());
    let closer: (() => unknown) | undefined;
    vi.doMock("@neondatabase/serverless", () => ({
      Pool: class {
        end = end;
      },
    }));
    vi.doMock("next/server", () => ({
      after: (fn: () => unknown) => {
        closer = fn;
      },
    }));
    const { getDb } = await import("@/server/db/client");
    await expect(getDb()).resolves.toBeDefined();
    expect(end).not.toHaveBeenCalled();
    await closer?.();
    expect(end).toHaveBeenCalledOnce();
    vi.doUnmock("@neondatabase/serverless");
  });
});
