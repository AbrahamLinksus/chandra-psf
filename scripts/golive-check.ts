// Go-live gate (SPEC §12.1): run against the production environment before the first real customer link.
// Checks are pure exported functions; main() wires real env + a read-only database count.
// Output names the failing key and counts only, never a value of a secret or personal data.
import { pathToFileURL } from "node:url";
import { Pool } from "@neondatabase/serverless";
import { CONTACT_PLACEHOLDERS, env as publicEnv } from "../src/config/env";
import { getServerEnv, isPgliteUrl } from "../src/server/env";

/** Public sample value from .env.example (src/config/env.ts keeps its copy private). */
export const DEALER_PHONE_PLACEHOLDER = "+91 44 0000 0000";

export interface Finding {
  key: string;
  message: string;
}

export interface ContactValues {
  NEXT_PUBLIC_COMPANY_NAME: string;
  NEXT_PUBLIC_PRIVACY_PHONE: string;
  NEXT_PUBLIC_PRIVACY_EMAIL: string;
  NEXT_PUBLIC_DEALER_PHONE: string;
}

/** Table name -> row count for everything that must not exist before launch. */
export type LaunchCounts = Record<string, number>;

/**
 * Customer-data tables that must be empty at launch. Setup data (branches, advisors, and staff
 * users of any role) is allowed to exist before launch; customer data is not.
 */
const EMPTY_TABLES = ["job_cards", "visits", "link_tokens", "responses", "alerts"] as const;

export function checkContacts(values: ContactValues): Finding[] {
  const findings: Finding[] = [];
  const placeholders: Record<string, string> = {
    ...CONTACT_PLACEHOLDERS,
    NEXT_PUBLIC_DEALER_PHONE: DEALER_PHONE_PLACEHOLDER,
  };
  for (const [key, placeholder] of Object.entries(placeholders)) {
    const value = (values as unknown as Record<string, string>)[key] ?? "";
    if (value.trim() === "" || value.trim() === placeholder) {
      findings.push({ key, message: "is empty or still the placeholder" });
    }
  }
  return findings;
}

const LOCAL_HOST = /^(localhost|127\.|0\.0\.0\.0|\[::1\])/i;

export function checkAppUrl(appUrl: string | undefined): Finding[] {
  const key = "APP_URL";
  if (!appUrl) return [{ key, message: "is not set" }];
  let url: URL;
  try {
    url = new URL(appUrl);
  } catch {
    return [{ key, message: "is not a valid URL" }];
  }
  if (url.protocol !== "https:") return [{ key, message: "must be https" }];
  if (LOCAL_HOST.test(url.hostname)) return [{ key, message: "must not be a local address" }];
  return [];
}

export function checkDatabaseUrl(databaseUrl: string): Finding[] {
  return isPgliteUrl(databaseUrl)
    ? [{ key: "DATABASE_URL", message: "is a local pglite database, not production" }]
    : [];
}

export function checkLaunchData(counts: LaunchCounts): Finding[] {
  const findings: Finding[] = [];
  for (const [table, n] of Object.entries(counts)) {
    if (n > 0)
      findings.push({
        key: table,
        message: `holds ${String(n)} row(s), customer data must not exist before launch`,
      });
  }
  return findings;
}

export function runChecks(input: {
  contacts: ContactValues;
  appUrl: string | undefined;
  databaseUrl: string;
  counts: LaunchCounts;
}): Finding[] {
  return [
    ...checkContacts(input.contacts),
    ...checkAppUrl(input.appUrl),
    ...checkDatabaseUrl(input.databaseUrl),
    ...checkLaunchData(input.counts),
  ];
}

export function formatReport(findings: Finding[]): string {
  if (findings.length === 0) return "golive:check PASSED: all go-live checks are green.";
  const lines = findings.map((f) => `  FAIL ${f.key}: ${f.message}`);
  return [`golive:check FAILED (${String(findings.length)} problem(s)):`, ...lines].join("\n");
}

/** Read-only counts. Table names come from a fixed list, never from input. */
async function countLaunchData(connectionString: string): Promise<LaunchCounts> {
  const pool = new Pool({ connectionString });
  try {
    const counts: LaunchCounts = {};
    for (const table of EMPTY_TABLES) {
      const res = await pool.query<{ n: string }>(`select count(*) as n from ${table}`);
      counts[table] = Number(res.rows[0]?.n ?? 0);
    }
    return counts;
  } finally {
    await pool.end();
  }
}

async function main(): Promise<void> {
  const server = getServerEnv();
  const counts = isPgliteUrl(server.DATABASE_URL) ? {} : await countLaunchData(server.DATABASE_URL);
  const findings = runChecks({
    contacts: publicEnv,
    appUrl: server.APP_URL,
    databaseUrl: server.DATABASE_URL,
    counts,
  });
  console.log(formatReport(findings));
  process.exit(findings.length === 0 ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err: unknown) => {
    console.error(`golive:check error: ${err instanceof Error ? err.name : "unknown error"}`);
    process.exit(1);
  });
}
