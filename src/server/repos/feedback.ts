import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, gte, isNull, sql } from "drizzle-orm";
import type { FeedbackRepo, FormContext } from "@/data/access/repos/feedback";
import { err, ok, type Result } from "@/data/access/result";
import { evaluateAlertReasons, reconcileAlert } from "@/domain/alertRules";
import { SYSTEM_ACTOR } from "@/domain/constants";
import { QUESTIONNAIRE_V2 } from "@/domain/questionnaire";
import type { AnswerMap } from "@/domain/types";
import { visitStatus } from "@/domain/visitStatus";
import { findStrayAnswers, validateSubmission } from "@/domain/visibility";
import { writeAudit } from "../audit";
import { guard, type RequestCtx } from "../ctx";
import type { Tx } from "../db/client";
import { alerts, jobCards, linkTokens, rateLimits, responses, visits } from "../db/schema";
import { hashCode } from "../tokens";
const HOUR_MS = 3_600_000;
const OPEN_LIMIT_PER_HOUR = 30;
const SUBMIT_LIMIT_PER_HOUR = 5;

type Ctx = Pick<RequestCtx, "db" | "clock">;
type VisitRow = typeof visits.$inferSelect;
type CardRow = typeof jobCards.$inferSelect;

/** What a customer's link code points at, before any limit or answer is looked at. */
type LinkState =
  | { kind: "invalid" }
  | { kind: "expired"; replaced: boolean }
  | { kind: "completed"; visit: VisitRow }
  | { kind: "ready"; visit: VisitRow; card: CardRow };

/** Fixed-window counter per (bucket, link). Counts this hit; true while within `limit`. */
async function hitLinkLimit(
  ctx: Ctx,
  bucket: "open" | "submit",
  code: string,
  limit: number,
): Promise<boolean> {
  const now = ctx.clock.now().getTime();
  const windowStart = new Date(Math.floor(now / HOUR_MS) * HOUR_MS);
  const [row] = await ctx.db
    .insert(rateLimits)
    .values({ bucket, key: hashCode(code), windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimits.bucket, rateLimits.key, rateLimits.windowStart],
      set: { count: sql`${rateLimits.count} + 1` },
    })
    .returning({ count: rateLimits.count });
  return (row?.count ?? 1) <= limit;
}

/** True when the code belongs to a stored link (so only real links get a counter row). */
async function linkExists(ctx: Pick<RequestCtx, "db">, code: string): Promise<boolean> {
  const rows = await ctx.db
    .select({ id: linkTokens.visitId })
    .from(linkTokens)
    .where(eq(linkTokens.tokenHash, hashCode(code)))
    .limit(1);
  return rows.length > 0;
}

/** Cancelled or erased: invalid; completed; replaced or superseded: expired (replaced); past expiry: expired. */
async function resolveLink(ctx: Ctx, code: string): Promise<LinkState> {
  const [row] = await ctx.db
    .select({ visit: visits, card: jobCards, supersededAt: linkTokens.supersededAt })
    .from(linkTokens)
    .innerJoin(visits, eq(visits.id, linkTokens.visitId))
    .innerJoin(jobCards, eq(jobCards.id, visits.jobCardId))
    .where(eq(linkTokens.tokenHash, hashCode(code)))
    .limit(1);
  if (!row) return { kind: "invalid" };
  const { visit, card } = row;
  if (visit.cancelledAt !== null || card.erasedAt !== null) return { kind: "invalid" };
  if (visit.completedAt !== null) return { kind: "completed", visit };
  if (row.supersededAt !== null || visit.replacedBy !== null) {
    return { kind: "expired", replaced: true };
  }
  const status = visitStatus(
    {
      id: visit.id,
      jobCardNo: card.jobCardNo,
      phone: card.phone,
      token: "",
      createdBy: visit.createdBy,
      createdAt: visit.createdAt.toISOString(),
      expiresAt: visit.expiresAt.toISOString(),
      openedAt: null,
      completedAt: null,
      cancelledAt: null,
      replacedBy: null,
    },
    ctx.clock.now(),
  );
  return status === "expired"
    ? { kind: "expired", replaced: false }
    : { kind: "ready", visit, card };
}

const NOT_VALID = "Link not valid";
const EXPIRED = "This feedback link has expired";
const DONE = "Feedback already received";
const BUSY = "Too many requests, try again in a few minutes";

type Ready = Extract<LinkState, { kind: "ready" }>;
type Submitted = Result<{ callbackRequested: boolean; callbackSlot?: string }>;

function callbackOf(answers: AnswerMap): { callbackRequested: boolean; callbackSlot?: string } {
  const slot = answers.Q10a;
  if (answers.Q10 !== "Yes") return { callbackRequested: false };
  return typeof slot === "string"
    ? { callbackRequested: true, callbackSlot: slot }
    : { callbackRequested: true };
}

function contextOf(s: Ready): FormContext {
  return {
    state: "ready",
    visitId: s.visit.id,
    customerName: s.card.customerName ?? "",
    model: s.card.model,
    regNo: s.card.regNo ?? "",
    serviceDate: s.card.serviceDate,
    questionnaire: QUESTIONNAIRE_V2,
  };
}

export class ServerFeedbackRepo implements FeedbackRepo {
  constructor(protected readonly ctx: RequestCtx) {}

  getVisitByToken: FeedbackRepo["getVisitByToken"] = (token) =>
    guard(this.ctx, "feedback.getVisitByToken", "read", async () => {
      if (!(await linkExists(this.ctx, token))) return ok<FormContext>({ state: "invalid" });
      if (!(await hitLinkLimit(this.ctx, "open", token, OPEN_LIMIT_PER_HOUR))) {
        return ok<FormContext>({ state: "rate_limited" });
      }
      const s = await resolveLink(this.ctx, token);
      if (s.kind === "expired") return ok<FormContext>({ state: "expired", replaced: s.replaced });
      if (s.kind === "ready") return ok(contextOf(s));
      return ok<FormContext>({ state: s.kind });
    });

  markOpened: FeedbackRepo["markOpened"] = (token) =>
    guard(this.ctx, "feedback.markOpened", "write", async () => {
      const now = this.ctx.clock.now();
      const [target] = await this.ctx.db
        .select({ id: linkTokens.visitId })
        .from(linkTokens)
        .where(and(eq(linkTokens.tokenHash, hashCode(token)), isNull(linkTokens.supersededAt)))
        .limit(1);
      if (!target) return ok(undefined);
      await this.ctx.db
        .update(visits)
        .set({ openedAt: now })
        .where(
          and(
            eq(visits.id, target.id),
            isNull(visits.openedAt),
            isNull(visits.completedAt),
            isNull(visits.cancelledAt),
            isNull(visits.replacedBy),
            gte(visits.expiresAt, now),
          ),
        );
      return ok(undefined);
    });

  submitResponse: FeedbackRepo["submitResponse"] = (token, answers, submissionId) =>
    guard(this.ctx, "feedback.submitResponse", "write", async () => {
      if (!(await linkExists(this.ctx, token))) return err("NOT_FOUND", NOT_VALID);
      if (!(await hitLinkLimit(this.ctx, "submit", token, SUBMIT_LIMIT_PER_HOUR))) {
        return err("RATE_LIMITED", BUSY);
      }
      const subId = submissionId ?? randomUUID();
      const s = await resolveLink(this.ctx, token);
      if (s.kind === "completed") return this.replay(this.ctx.db, s.visit.id, subId);
      if (s.kind === "invalid") return err("NOT_FOUND", NOT_VALID);
      if (s.kind === "expired") return err("CONFLICT", EXPIRED);
      const stray = findStrayAnswers(answers);
      if (stray.length > 0) return err("VALIDATION", "Some answers are not valid.", stray);
      const checked = validateSubmission(answers);
      if (!checked.ok) {
        return err("VALIDATION", "Answer every question to submit.", checked.missing);
      }
      return this.ctx.db.transaction((tx) => this.store(tx, s, checked.answers, subId));
    });

  /** Same phone, same submission id: the original result again; anything else is a second submit. */
  private async replay(db: Pick<Tx, "select">, visitId: string, subId: string): Promise<Submitted> {
    const [row] = await db
      .select({ answers: responses.answers, submissionId: responses.submissionId })
      .from(responses)
      .where(eq(responses.visitId, visitId))
      .limit(1);
    if (row?.submissionId !== subId) return err("ALREADY_COMPLETED", DONE);
    return ok(callbackOf(row.answers as AnswerMap));
  }

  private async store(tx: Tx, s: Ready, answers: AnswerMap, subId: string): Promise<Submitted> {
    const now = this.ctx.clock.now();
    const claimed = await tx
      .update(visits)
      .set({ completedAt: now, openedAt: s.visit.openedAt ?? now })
      .where(
        and(
          eq(visits.id, s.visit.id),
          isNull(visits.completedAt),
          isNull(visits.cancelledAt),
          isNull(visits.replacedBy),
          gte(visits.expiresAt, now),
        ),
      )
      .returning({ id: visits.id });
    if (claimed.length === 0) return this.afterLostRace(tx, s.visit.id, subId);
    const [resp] = await tx
      .insert(responses)
      .values({
        visitId: s.visit.id,
        questionsVersion: QUESTIONNAIRE_V2.version,
        answers,
        submissionId: subId,
        submittedAt: now,
      })
      .returning({ id: responses.id });
    if (!resp) throw new Error("insert returned no row");
    await this.raiseAlert(tx, s.visit.branchId, resp.id, answers);
    return ok(callbackOf(answers));
  }

  /** The claiming update matched nothing: someone finished first (same id: replay), or the link just lapsed. */
  private async afterLostRace(tx: Tx, visitId: string, subId: string): Promise<Submitted> {
    const [v] = await tx.select().from(visits).where(eq(visits.id, visitId)).limit(1);
    if (v?.completedAt) return this.replay(tx, visitId, subId);
    return err("CONFLICT", EXPIRED);
  }

  private async raiseAlert(tx: Tx, branchId: string, responseId: string, answers: AnswerMap) {
    const now = this.ctx.clock.now();
    const id = randomUUID();
    const { alert } = reconcileAlert(null, evaluateAlertReasons(answers), now, { id, responseId });
    if (!alert) return;
    await tx.insert(alerts).values({
      id,
      responseId,
      branchId,
      reasons: alert.reasons,
      status: "open",
      notes: [],
      createdAt: now,
      updatedAt: now,
    });
    await writeAudit(this.ctx, tx, {
      action: "alert.create",
      entityType: "alert",
      entityId: id,
      branchId,
      actor: { id: null, name: SYSTEM_ACTOR },
      newValue: { reasons: alert.reasons },
    });
  }
}
