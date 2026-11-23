import { rmSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { initAdmin } from "../../scripts/admin";
import { adminPasswordFiles } from "../support/e2e";
import * as schema from "../../src/server/db/schema";

export const E2E_ADMIN = { name: "E2E Admin", email: "admin@e2e.test" };

/**
 * The directory global setup may delete: PORT (when set) must be digits only, and the
 * resolved directory must stay inside `root`. Throws before anything is touched.
 */
export function e2eDataDir(
  env: Readonly<Record<string, string | undefined>>,
  root: string,
): string {
  const port = env["PORT"];
  if (port !== undefined && !/^\d+$/.test(port)) {
    throw new Error(`e2e setup: PORT must be digits only, got "${port}"`);
  }
  const url = env["DATABASE_URL"] ?? "";
  if (!url.startsWith("pglite:./")) throw new Error(`e2e needs a pglite directory, got "${url}"`);
  const dir = resolve(root, url.slice("pglite:".length));
  const rel = relative(root, dir);
  if (rel === "" || rel === ".." || rel.startsWith(`..${sep}`)) {
    throw new Error(`e2e setup: refusing to delete "${dir}", it is outside the repo`);
  }
  return dir;
}

/**
 * Fresh PGlite data dir, migrate, then `admin init`, before any spec runs. The one-time
 * password reaches specs through the environment (`adminCredentials()` in tests/support/e2e.ts).
 */
export default async function globalSetup(): Promise<void> {
  const dir = e2eDataDir(process.env, process.cwd());
  rmSync(dir, { recursive: true, force: true });
  const { marker, lock } = adminPasswordFiles();
  rmSync(marker, { force: true });
  rmSync(lock, { force: true });
  const client = new PGlite(dir);
  try {
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: "drizzle" });
    const result = await initAdmin({ db }, E2E_ADMIN);
    if (!result.created) throw new Error(`e2e setup: ${result.message}`);
    process.env["E2E_ADMIN_EMAIL"] = result.email;
    process.env["E2E_ADMIN_PASSWORD"] = result.password;
  } finally {
    await client.close();
  }
}
