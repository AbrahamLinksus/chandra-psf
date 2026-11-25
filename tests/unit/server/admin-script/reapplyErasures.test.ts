// @vitest-environment node
/* eslint-disable max-lines-per-function -- one scenario per test */
import { execFileSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { advisors, erasureJournal, jobCards } from "@/server/db/schema";
import { makeServerCtx, must, seedBranch, seedUser } from "../../../support/serverCtx";
import { TSX_CLI } from "../../../support/nodeCli";
import { reapplyErasures } from "../../../../scripts/admin";

type Env = Awaited<ReturnType<typeof makeServerCtx>>;
type Entry = { source: "request" | "retention"; erasedAt: Date };
let live: Env;
let restored: Env;
let stdout: string[] = [];

beforeEach(async () => {
  live = await makeServerCtx();
  restored = await makeServerCtx();
  stdout = [];
  vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => {
    stdout.push(String(chunk));
    return true;
  });
});
afterEach(async () => {
  vi.restoreAllMocks();
  await live.client.close();
  await restored.client.close();
});

/** Same card ids in both databases; the live journal gets one entry per item. */
async function seed(entries: Entry[]) {
  const ids = entries.map(() => crypto.randomUUID());
  for (const d of [live, restored]) {
    const branch = await seedBranch(d.db, "Velachery");
    const [adv] = await d.db.insert(advisors).values({ branchId: branch, name: "A" }).returning();
    const by = await seedUser(d.db, { role: "support", branchId: branch });
    for (const [i, id] of ids.entries()) {
      await d.db.insert(jobCards).values({
        id,
        branchId: branch,
        jobCardNo: `JC-${String(i)}`,
        jobCardKey: `JC${String(i)}`,
        customerName: "Ramesh Kumar",
        phone: "+919840012345",
        phoneKey: "9840012345",
        regNo: `TN09BX${String(1000 + i)}`,
        regNoKey: `TN09BX${String(1000 + i)}`,
        model: "Activa 6G",
        vehicleType: "scooter",
        advisorId: must(adv).id,
        serviceType: "Paid service",
        serviceDate: "2026-11-14",
        createdBy: by,
      });
    }
  }
  for (const [i, e] of entries.entries()) {
    await live.db
      .insert(erasureJournal)
      .values({ jobCardId: must(ids[i]), source: e.source, erasedAt: e.erasedAt });
  }
  return ids;
}

const erasedIds = async () =>
  (await restored.db.select().from(jobCards))
    .filter((c) => c.erasedAt !== null)
    .map((c) => c.id)
    .sort();
const events = () =>
  stdout
    .join("")
    .split("\n")
    .filter((l) => l.includes('"event":"erasure"'))
    .map((l) => JSON.parse(l) as { source: string; count: number });

const D = (s: string) => new Date(`${s}T00:00:00Z`);

describe("reapplyErasures (M2)", () => {
  it("works in chunks, one transaction each, and erases everything across chunks", async () => {
    const ids = await seed(
      ["01", "02", "03", "04", "05"].map((d) => ({
        source: "request",
        erasedAt: D(`2026-12-${d}`),
      })),
    );
    const tx = vi.spyOn(restored.db, "transaction");
    expect(await reapplyErasures({ db: restored.db }, live.db, { chunkSize: 2 })).toEqual({
      erased: 5,
    });
    expect(tx).toHaveBeenCalledTimes(3);
    expect(await erasedIds()).toEqual([...ids].sort());
  });

  it("--since erases only entries erased after that date (strictly newer)", async () => {
    const ids = await seed([
      { source: "request", erasedAt: D("2026-12-01") },
      { source: "request", erasedAt: D("2026-12-05") },
      { source: "retention", erasedAt: D("2026-12-09") },
    ]);
    const r = await reapplyErasures({ db: restored.db }, live.db, { since: D("2026-12-05") });
    expect(r).toEqual({ erased: 1 });
    expect(await erasedIds()).toEqual([must(ids[2])]);
  });

  it("logs the real source of each entry and keeps it in the journal", async () => {
    await seed([
      { source: "request", erasedAt: D("2026-12-01") },
      { source: "retention", erasedAt: D("2026-12-02") },
      { source: "retention", erasedAt: D("2026-12-03") },
    ]);
    await reapplyErasures({ db: restored.db }, live.db);
    const bySource = Object.fromEntries(events().map((e) => [e.source, e.count]));
    expect(bySource).toEqual({ request: 1, retention: 2 });
    const journal = await restored.db.select().from(erasureJournal);
    expect(journal.map((j) => j.source).sort()).toEqual(["request", "retention", "retention"]);
  });

  it("an invalid --since date is refused with the AdminError message", () => {
    const args = [TSX_CLI, "scripts/admin.ts", "reapply-erasures", "--from", "pglite:memory"];
    const run = () =>
      execFileSync(process.execPath, [...args, "--since", "not-a-date"], {
        env: { ...process.env, DATABASE_URL: "pglite:memory", DATABASE_URL_UNPOOLED: "" },
        encoding: "utf8",
        stdio: "pipe",
      });
    expect(run).toThrow(/--since is not a valid date/);
  });
});
