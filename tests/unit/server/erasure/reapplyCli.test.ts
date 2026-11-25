// @vitest-environment node
/* eslint-disable max-lines-per-function -- one end-to-end CLI scenario */
import { execFile } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/server/db/schema";
import { advisors, erasureJournal, jobCards } from "@/server/db/schema";
import { must, seedBranch, seedUser } from "../../../support/serverCtx";

const run = promisify(execFile);
const dirs: string[] = [];
let work = "";

beforeAll(() => {
  work = mkdtempSync(join(tmpdir(), "psf-reapply-"));
});
afterAll(() => {
  rmSync(work, { recursive: true, force: true });
});

async function open(name: string) {
  const dir = join(work, name);
  dirs.push(dir);
  const client = new PGlite(dir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "drizzle" });
  return { client, db, url: `pglite:${dir.replaceAll("\\", "/")}` };
}

describe("admin reapply-erasures --from <url> (S-24)", () => {
  it("re-erases the journal ids of the --from database in the target, and says so", async () => {
    const live = await open("live");
    const restored = await open("restored");
    const id = crypto.randomUUID();
    for (const d of [live, restored]) {
      const branch = await seedBranch(d.db, "Velachery");
      const [adv] = await d.db.insert(advisors).values({ branchId: branch, name: "A" }).returning();
      await d.db.insert(jobCards).values({
        id,
        branchId: branch,
        jobCardNo: "JC-1",
        jobCardKey: "JC1",
        customerName: "Ramesh Kumar",
        phone: "+919840012345",
        phoneKey: "9840012345",
        regNo: "TN09BX4521",
        regNoKey: "TN09BX4521",
        model: "Activa",
        vehicleType: "scooter",
        advisorId: must(adv).id,
        serviceType: "Paid service",
        serviceDate: "2026-11-14",
        createdBy: await seedUser(d.db, { role: "support", branchId: branch }),
      });
    }
    // The live database erased the card earlier; its journal says so.
    await live.db.insert(erasureJournal).values({ jobCardId: id, source: "request" });
    await live.client.close();
    await restored.client.close();

    const env = { ...process.env, DATABASE_URL: restored.url, DATABASE_URL_UNPOOLED: "" };
    const args = ["tsx", "scripts/admin.ts", "reapply-erasures", "--from", live.url];
    const first = await run("pnpm", ["exec", ...args], { env, shell: true });
    expect(first.stdout).toContain("Re-erased 1 job card(s).");
    const second = await run("pnpm", ["exec", ...args], { env, shell: true });
    expect(second.stdout).toContain("Re-erased 0 job card(s).");

    const check = new PGlite(join(work, "restored"));
    try {
      const db = drizzle(check, { schema });
      const [row] = await db.select().from(jobCards).where(eq(jobCards.id, id));
      expect(row?.customerName).toBeNull();
      expect(row?.phone).toBeNull();
      expect(row?.erasedAt).not.toBeNull();
    } finally {
      await check.close();
    }
  }, 120_000);
});
