import { and, eq, exists, inArray, isNotNull, isNull, lt, lte, not, or } from "drizzle-orm";
import {
  ADMIN_IDLE_HOURS,
  ATTEMPTS_RETENTION_HOURS,
  CLEANUP_BATCH_SIZE,
  SESSION_MAX_DAYS,
  SUPPORT_IDLE_HOURS,
} from "@/domain/constants";
import { retentionCutoffs } from "@/domain/retention";
import type { Db, Tx } from "../db/client";
import {
  alerts,
  jobCards,
  loginAttempts,
  rateLimits,
  responses,
  sessions,
  users,
  visits,
} from "../db/schema";
import { writeAudit } from "../audit";
import type { Clock } from "../ctx";
import { eraseJobCards, logErasure, redactAudit } from "../erasure";

/** Batches stop here so the run ends inside the 300 s function limit; the next run continues (LLD §25). */
export const CLEANUP_BUDGET_MS = 240_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

export interface CleanupCounts {
  unansweredErased: number;
  answeredErased: number;
  responsesPurged: number;
  sessionsRemoved: number;
  attemptsRemoved: number;
  limitsRemoved: number;
  /** True when the time budget ran out before every batch step finished. */
  stoppedEarly: boolean;
}

export interface CleanupOptions {
  /** Monotonic milliseconds; tests inject a fake to exercise the time limit. */
  elapsedMs?: () => number;
  budgetMs?: number;
}

type Budget = () => boolean;

function hasCompletedVisit(db: Db) {
  return exists(
    db
      .select({ one: visits.id })
      .from(visits)
      .where(and(eq(visits.jobCardId, jobCards.id), isNotNull(visits.completedAt))),
  );
}

async function eraseDue(
  db: Db,
  answered: boolean,
  cutoff: string,
  now: Date,
  hasBudget: Budget,
): Promise<number> {
  let total = 0;
  while (hasBudget()) {
    const completed = hasCompletedVisit(db);
    const due = await db
      .select({ id: jobCards.id })
      .from(jobCards)
      .where(
        and(
          isNull(jobCards.erasedAt),
          lte(jobCards.serviceDate, cutoff),
          answered ? completed : not(completed),
        ),
      )
      .limit(CLEANUP_BATCH_SIZE);
    if (due.length === 0) break;
    const ids = due.map((c) => c.id);
    const erased = await db.transaction((tx) => eraseJobCards(tx, ids, "retention", now));
    logErasure("retention", erased);
    total += erased.length;
    if (erased.length === 0) break; // nothing left that this step can erase
  }
  return total;
}

async function purgeBatch(tx: Tx, ids: string[], clock: Clock): Promise<void> {
  const alertIds = (
    await tx.select({ id: alerts.id }).from(alerts).where(inArray(alerts.responseId, ids))
  ).map((a) => a.id);
  // Edit/note audit rows hold customer text; once the response is gone erasure can't find them.
  await redactAudit(tx, [
    ["response", ids],
    ["alert", alertIds],
  ]);
  await tx.delete(alerts).where(inArray(alerts.responseId, ids));
  await tx.delete(responses).where(inArray(responses.id, ids));
  for (const id of ids) {
    await writeAudit({ session: null, clock }, tx, {
      action: "response.purge",
      entityType: "response",
      entityId: id,
      branchId: null,
    });
  }
}

async function purgeDeleted(
  db: Db,
  before: string,
  clock: Clock,
  hasBudget: Budget,
): Promise<number> {
  let total = 0;
  while (hasBudget()) {
    const rows = await db
      .select({ id: responses.id })
      .from(responses)
      .where(and(isNotNull(responses.deletedAt), lt(responses.deletedAt, new Date(before))))
      .limit(CLEANUP_BATCH_SIZE);
    if (rows.length === 0) break;
    const ids = rows.map((r) => r.id);
    await db.transaction((tx) => purgeBatch(tx, ids, clock));
    total += ids.length;
  }
  return total;
}

/** Sessions past the 7-day cap or their role's idle limit (same rules as session lookup, LLD §18.2). */
async function removeExpiredSessions(db: Db, now: Date): Promise<number> {
  const t = now.getTime();
  const idle = (adminRoles: boolean, hours: number) =>
    and(
      inArray(
        sessions.userId,
        db
          .select({ id: users.id })
          .from(users)
          .where(
            adminRoles
              ? inArray(users.role, ["branch_admin", "main_admin"])
              : eq(users.role, "support"),
          ),
      ),
      lte(sessions.lastActiveAt, new Date(t - hours * HOUR_MS)),
    );
  const gone = await db
    .delete(sessions)
    .where(
      or(
        lte(sessions.createdAt, new Date(t - SESSION_MAX_DAYS * DAY_MS)),
        idle(true, ADMIN_IDLE_HOURS),
        idle(false, SUPPORT_IDLE_HOURS),
      ),
    )
    .returning({ id: sessions.idHash });
  return gone.length;
}

async function removeOldAttempts(db: Db, now: Date): Promise<{ attempts: number; limits: number }> {
  const cutoff = new Date(now.getTime() - ATTEMPTS_RETENTION_HOURS * HOUR_MS);
  const attempts = await db
    .delete(loginAttempts)
    .where(lt(loginAttempts.at, cutoff))
    .returning({ id: loginAttempts.id });
  const limits = await db
    .delete(rateLimits)
    .where(lt(rateLimits.windowStart, cutoff))
    .returning({ bucket: rateLimits.bucket });
  return { attempts: attempts.length, limits: limits.length };
}

/** The daily clean-up (LLD §25, SPEC F-10 step 5). Every step is idempotent; batches stop at the time budget. */
export async function runDailyCleanup(
  db: Db,
  clock: Clock,
  options: CleanupOptions = {},
): Promise<CleanupCounts> {
  const elapsedMs = options.elapsedMs ?? ((): number => performance.now());
  const budgetMs = options.budgetMs ?? CLEANUP_BUDGET_MS;
  const startedAt = elapsedMs();
  const hasBudget: Budget = () => elapsedMs() - startedAt < budgetMs;
  const now = clock.now();
  const cut = retentionCutoffs(now);

  const unansweredErased = await eraseDue(db, false, cut.unansweredOn, now, hasBudget);
  const answeredErased = await eraseDue(db, true, cut.answeredOn, now, hasBudget);
  const responsesPurged = await purgeDeleted(db, cut.deletedBefore, clock, hasBudget);
  const stoppedEarly = !hasBudget();
  const sessionsRemoved = await removeExpiredSessions(db, now);
  const { attempts, limits } = await removeOldAttempts(db, now);

  const counts: CleanupCounts = {
    unansweredErased,
    answeredErased,
    responsesPurged,
    sessionsRemoved,
    attemptsRemoved: attempts,
    limitsRemoved: limits,
    stoppedEarly,
  };
  await writeAudit({ session: null, clock }, db, {
    action: "system.cleanup",
    entityType: "system",
    entityId: "daily",
    newValue: counts,
    branchId: null,
  });
  return counts;
}
