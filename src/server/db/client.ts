import "server-only";
import { Pool } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { after } from "next/server";
import { getServerEnv, isPgliteUrl } from "../env";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const PGLITE_PREFIX_LENGTH = "pglite:".length;
const pgliteCache = new Map<string, Promise<Db>>();

/** `pglite:memory` or `pglite:<dir>`; one instance per target for the life of the process. Never reached in production (env.ts rejects it). */
function getPglite(url: string): Promise<Db> {
  const target = url.slice(PGLITE_PREFIX_LENGTH);
  let db = pgliteCache.get(target);
  if (!db) {
    db = (async () => {
      const [{ PGlite }, { drizzle }, { migrate }] = await Promise.all([
        import("@electric-sql/pglite"),
        import("drizzle-orm/pglite"),
        import("drizzle-orm/pglite/migrator"),
      ]);
      const client = new PGlite(target === "memory" ? undefined : target);
      const pg = drizzle(client, { schema });
      await migrate(pg, { migrationsFolder: "drizzle" });
      return pg;
    })();
    db.catch(() => pgliteCache.delete(target)); // a failed start must not stick
    pgliteCache.set(target, db);
  }
  return db;
}

function getNeon(url: string): Db {
  const pool = new Pool({ connectionString: url });
  after(() => pool.end());
  return drizzleNeon(pool, { schema });
}

/** Per request. Neon (pooled) in production, PGlite for local dev and tests. */
export async function getDb(): Promise<Db> {
  const url = getServerEnv().DATABASE_URL;
  return isPgliteUrl(url) ? getPglite(url) : getNeon(url);
}

export function withTx<T>(db: Db, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(fn);
}
