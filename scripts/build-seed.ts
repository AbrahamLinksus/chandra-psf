/**
 * Builds src/data/seed/seed.json from the owner's xlsx (LLD 4, SPEC 6).
 * `pnpm seed` writes the file; `pnpm seed --check` fails when the file is stale.
 * Deterministic: fixed PRNG seed, no clock, no randomness from the environment.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SeedSchema, type SeedTime, type Seed } from "../src/domain/schemas";
import { readSurveyRows, type SurveyRow } from "./seed/answers";
import {
  ADVISORS,
  EXTRA_ROWS,
  FRESH_NAMES,
  FRESH_OFFSETS,
  RESPONSE_DAY_SPAN,
  SEED_VALUE,
  UNANSWERED,
  UNANSWERED_NAMES,
  USERS,
} from "./seed/data";
import {
  buildAnswered,
  jobCardNo,
  linkAudit,
  makeJobCard,
  makeRng,
  makeVisit,
  pad,
  t,
  workMinute,
  type Rng,
  type SeedJobCard,
} from "./seed/entities";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const XLSX_PATH = path.resolve(
  HERE,
  "../data/seed/Honda_PSF_Survey_30_Dummy_Customer_Responses.xlsx",
);
const OUT_PATH = path.resolve(HERE, "../src/data/seed/seed.json");
const MINUTES_PER_DAY = 1440;

type Unanswered = Pick<Seed, "jobCards" | "visits" | "audit">;

function buildUnanswered(start: number, rng: Rng): Unanswered {
  const out: Unanswered = { jobCards: [], visits: [], audit: [] };
  UNANSWERED.forEach((u, k) => {
    const n = start + k;
    const card = makeJobCard(jobCardNo(n - 1), UNANSWERED_NAMES[k] ?? "Customer", n, u.offset, rng);
    const visit = makeVisit(`v-s${pad(n)}`, card, u.kind, workMinute(rng), n);
    out.jobCards.push(card);
    out.visits.push(visit);
    out.audit.push(linkAudit(visit, n));
  });
  return out;
}

/** JC-24-1042 is the SPEC 5 example card (Ramesh Kumar); it has no visit. */
function buildFresh(start: number, rng: Rng): SeedJobCard[] {
  const ramesh: SeedJobCard = {
    jobCardNo: "JC-24-1042",
    customerName: "Ramesh Kumar",
    phone: "+91 98400 12345",
    regNo: "TN 09 BX 4521",
    model: "Activa 6G",
    vehicleType: "scooter",
    serviceType: "Paid service",
    serviceDate: t(-7, 0),
    advisorId: "a-suresh",
  };
  const others = FRESH_NAMES.map((name, k) =>
    makeJobCard(jobCardNo(start + k), name, start + k, FRESH_OFFSETS[k] ?? -1, rng),
  );
  return [ramesh, ...others];
}

const age = (x: { at: SeedTime }): number => x.at.dayOffset * MINUTES_PER_DAY + x.at.minute;

export function buildFromRows(survey: SurveyRow[]): Seed {
  const rng = makeRng(SEED_VALUE);
  const rows = [...survey, ...EXTRA_ROWS];
  const answered = buildAnswered(rows, RESPONSE_DAY_SPAN, rng);
  const open = buildUnanswered(rows.length + 1, rng);
  const fresh = buildFresh(rows.length + open.visits.length, rng);
  const seed: Seed = {
    users: USERS.map((u, i) => ({
      ...u,
      active: true,
      mustSetPassword: false,
      createdAt: t(-90, 600 + i),
    })),
    advisors: ADVISORS,
    jobCards: [...answered.jobCards, ...open.jobCards, ...fresh],
    visits: [...answered.visits, ...open.visits],
    responses: answered.responses,
    alerts: answered.alerts,
    audit: [...answered.audit, ...open.audit].sort((a, b) => age(a) - age(b)),
  };
  SeedSchema.parse(seed);
  return seed;
}

export async function buildSeed(file: string = XLSX_PATH): Promise<Seed> {
  return buildFromRows(await readSurveyRows(file));
}

export const serialize = (seed: Seed): string => `${JSON.stringify(seed, null, 2)}\n`;

async function main(check: boolean): Promise<number> {
  const next = serialize(await buildSeed());
  if (!check) {
    writeFileSync(OUT_PATH, next);
    console.log(`Wrote ${OUT_PATH}`);
    return 0;
  }
  if (readFileSync(OUT_PATH, "utf8") === next) {
    console.log("seed.json is up to date");
    return 0;
  }
  console.error("seed.json is stale: run `pnpm seed`");
  return 1;
}

if (
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  process.exitCode = await main(process.argv.includes("--check"));
}
