// CR-2 cleanup (SPEC F-9): clears all feedback data and installs questionnaire v2.
import { QUESTIONNAIRE_V2 } from "../src/domain/questionnaire";
import { writeAudit } from "../src/server/audit";
import type { Db } from "../src/server/db/client";
import {
  alerts,
  linkTokens,
  questionnaires,
  rateLimits,
  responses,
  visits,
} from "../src/server/db/schema";

export class ClearRefused extends Error {}

/** Host of the database URL ("pglite" for pglite: URLs). Never returns or throws the URL itself. */
export function databaseHostOf(url: string): string {
  if (url.startsWith("pglite:")) return "pglite";
  try {
    return new URL(url).hostname;
  } catch {
    throw new ClearRefused("refused: the database URL in use is not a valid URL");
  }
}

export interface ClearResult {
  alerts: number;
  responses: number;
  linkTokens: number;
  visits: number;
  questionnaires: number;
}

function assertMayClear(input: {
  confirm: boolean;
  expectedHost: string | undefined;
  actualHost: string;
  env?: { VERCEL_ENV?: string | undefined; NODE_ENV?: string | undefined };
}): void {
  const env = input.env ?? process.env;
  if (env.VERCEL_ENV === "production" || env.NODE_ENV === "production") {
    throw new ClearRefused("refused: clear-feedback never runs against production");
  }
  if (!input.confirm) {
    throw new ClearRefused(
      "refused: pass --confirm-delete-all-feedback to delete all feedback data",
    );
  }
  if (!input.expectedHost || input.expectedHost !== input.actualHost) {
    throw new ClearRefused(
      `refused: --database-host must be ${input.actualHost}, the database this command would wipe`,
    );
  }
}

/**
 * CR-2 cleanup: deletes alerts, answers (responses), links and visits and the v1 questionnaire,
 * installs v2, in one transaction. Keeps branches, advisors, users, job cards, the audit log and the
 * erasure journal. Refused on production, without the confirm flag, and unless --database-host names the host in use.
 */
export async function clearFeedback(
  deps: { db: Db; now?: () => Date },
  input: {
    confirm: boolean;
    /** Host the operator says they are wiping (--database-host). */
    expectedHost: string | undefined;
    /** Host of the DATABASE_URL this run actually uses. */
    actualHost: string;
    env?: { VERCEL_ENV?: string | undefined; NODE_ENV?: string | undefined };
  },
): Promise<ClearResult> {
  assertMayClear(input);
  return deps.db.transaction(async (tx) => {
    const result: ClearResult = {
      alerts: (await tx.delete(alerts).returning({ id: alerts.id })).length,
      responses: (await tx.delete(responses).returning({ id: responses.id })).length,
      linkTokens: (await tx.delete(linkTokens).returning({ id: linkTokens.visitId })).length,
      visits: (await tx.delete(visits).returning({ id: visits.id })).length,
      questionnaires: (await tx.delete(questionnaires).returning({ v: questionnaires.version }))
        .length,
    };
    await tx.delete(rateLimits);
    await tx
      .insert(questionnaires)
      .values({ version: QUESTIONNAIRE_V2.version, definition: QUESTIONNAIRE_V2 });
    await writeAudit({ session: null, clock: { now: deps.now ?? (() => new Date()) } }, tx, {
      action: "system.cleanup",
      entityType: "system",
      entityId: "clear-feedback",
      newValue: { ...result, installedVersion: QUESTIONNAIRE_V2.version },
      note: "CR-2: feedback cleared, questionnaire v2 installed",
      branchId: null,
    });
    return result;
  });
}

export async function runClear(
  db: Db,
  opts: { confirm: boolean; expectedHost: string | undefined; databaseUrl: string },
): Promise<void> {
  const actualHost = databaseHostOf(opts.databaseUrl);
  const r = await clearFeedback(
    { db },
    { confirm: opts.confirm, expectedHost: opts.expectedHost, actualHost },
  );
  console.log(
    `Cleared: ${String(r.alerts)} alert(s), ${String(r.responses)} response(s) with answers, ` +
      `${String(r.linkTokens)} link(s), ${String(r.visits)} visit(s), ` +
      `${String(r.questionnaires)} old questionnaire(s). Questionnaire v2 installed.`,
  );
}
