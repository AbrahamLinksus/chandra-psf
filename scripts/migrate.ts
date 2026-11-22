import { PGlite } from "@electric-sql/pglite";
import { Pool } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { migrate as migrateNeon } from "drizzle-orm/neon-serverless/migrator";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { isPgliteUrl, parseServerEnv } from "../src/server/env";

const MIGRATIONS_FOLDER = "drizzle";
const PGLITE_PREFIX_LENGTH = "pglite:".length;

async function main(): Promise<void> {
  const env = parseServerEnv(process.env);
  if (isPgliteUrl(env.DATABASE_URL)) {
    const target = env.DATABASE_URL.slice(PGLITE_PREFIX_LENGTH);
    const client = new PGlite(target === "memory" ? undefined : target);
    await migratePglite(drizzlePglite(client), { migrationsFolder: MIGRATIONS_FOLDER });
    await client.close();
    console.log(`migrations applied (pglite:${target})`);
    return;
  }
  if (!env.DATABASE_URL_UNPOOLED) {
    throw new Error("DATABASE_URL_UNPOOLED is required to migrate a Postgres database");
  }
  const pool = new Pool({ connectionString: env.DATABASE_URL_UNPOOLED });
  try {
    await migrateNeon(drizzleNeon(pool), { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await pool.end();
  }
  console.log("migrations applied (postgres)");
}

main().catch((err: unknown) => {
  console.error(`migrate failed: ${err instanceof Error ? err.message : "unknown error"}`);
  process.exit(1);
});
