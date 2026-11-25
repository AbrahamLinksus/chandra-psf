import "server-only";
import { randomUUID } from "node:crypto";
import { and, between, desc, eq, isNotNull, isNull, type SQL } from "drizzle-orm";
import type { ResponseDetail, ResponseListRow, ResponseRepo } from "@/data/access";
import { err, ok, type Result } from "@/data/access/result";
import { evaluateAlertReasons, reconcileAlert } from "@/domain/alertRules";
import { DELETED_PURGE_DAYS } from "@/domain/constants";
import { QUESTIONNAIRE_V2 } from "@/domain/questionnaire";
import { addDays, istDateOf } from "@/domain/time";
import type { Alert, AnswerMap, AuditAction } from "@/domain/types";
import { validateSubmission } from "@/domain/visibility";
import { writeAudit } from "../audit";
import { verifyStepUp } from "../auth/stepUp";
import { guard, type RequestCtx } from "../ctx";
import type { Db, Tx } from "../db/client";
import { advisors, alerts, branches, jobCards, responses, users, visits } from "../db/schema";
import { branchFilter, requireAdmin, scopeOf } from "../scope";
import { summaryOf } from "./visitRows";

const NOT_FOUND = "Not found";
const STALE = "Someone else changed this. Reload to see the latest.";
const ERASED = "Erased customer";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** The list shows at most this many newest responses. */
const LIST_LIMIT = 500;

type Mode = "live" | "deleted";

/** Responses of one scope (live or deleted), with everything the screens show. */
function select(db: Db | Tx, where: SQL | undefined, mode: Mode, limit: number) {
  const state = mode === "live" ? isNull(responses.deletedAt) : isNotNull(responses.deletedAt);
  return db
    .select({
      response: responses,
      visit: visits,
      card: jobCards,
      advisorName: advisors.name,
      branchName: branches.name,
      creatorName: users.name,
      alert: alerts,
    })
    .from(responses)
    .innerJoin(visits, eq(visits.id, responses.visitId))
    .innerJoin(jobCards, eq(jobCards.id, visits.jobCardId))
    .innerJoin(advisors, eq(advisors.id, jobCards.advisorId))
    .innerJoin(branches, eq(branches.id, visits.branchId))
    .innerJoin(users, eq(users.id, visits.createdBy))
    .leftJoin(alerts, eq(alerts.responseId, responses.id))
    .where(and(state, where))
    .orderBy(desc(mode === "live" ? responses.submittedAt : responses.deletedAt))
    .limit(limit);
}

type Row = Awaited<ReturnType<typeof select>>[number];

function alertOf(a: Row["alert"], erased: boolean): Alert | null {
  if (!a) return null;
  return {
    id: a.id,
    responseId: a.responseId,
    reasons: a.reasons as Alert["reasons"],
    status: a.status,
    notes: erased ? [] : (a.notes as Alert["notes"]),
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

function nameOf(r: Row): string {
  const { card } = r;
  return card.erasedAt !== null || card.customerName === null ? ERASED : card.customerName;
}

function detailOf(ctx: RequestCtx, r: Row): ResponseDetail {
  const { card, response } = r;
  const erased = card.erasedAt !== null;
  return {
    response: {
      id: response.id,
      visitId: response.visitId,
      questionsVersion: response.questionsVersion,
      submittedAt: response.submittedAt.toISOString(),
      answers: response.answers as AnswerMap,
      deletedAt: response.deletedAt?.toISOString() ?? null,
    },
    visit: summaryOf(
      { visit: r.visit, card, creatorName: r.creatorName },
      ctx.clock.now(),
      ctx.session?.user.id ?? "",
    ),
    jobCard: {
      jobCardNo: card.jobCardNo,
      customerName: nameOf(r),
      phone: erased ? null : card.phone,
      regNo: erased ? "" : (card.regNo ?? ""),
      model: card.model,
      vehicleType: card.vehicleType,
      serviceType: card.serviceType,
      serviceDate: card.serviceDate,
      advisorId: card.advisorId,
      advisorName: r.advisorName,
    },
    questionnaire: QUESTIONNAIRE_V2,
    alert: alertOf(r.alert, erased),
    branchName: r.branchName,
    version: response.version,
  };
}

function listRowOf(r: Row): ResponseListRow {
  const q1 = (r.response.answers as AnswerMap).Q1;
  return {
    id: r.response.id,
    serviceDate: r.card.serviceDate,
    customerName: nameOf(r),
    model: r.card.model,
    advisorName: r.advisorName,
    branchName: r.branchName,
    q12: typeof q1 === "number" ? q1 : 0,
    hasAlert: r.alert !== null,
  };
}

/** Only the questions whose answer changed, so the audit shows `{Q4:2,Q4a:...}` then `{Q4:4}`. */
function diffAnswers(before: AnswerMap, after: AnswerMap): { old: AnswerMap; next: AnswerMap } {
  const old: AnswerMap = {};
  const next: AnswerMap = {};
  for (const q of QUESTIONNAIRE_V2.questions) {
    const a = before[q.code];
    const b = after[q.code];
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    if (a !== undefined) old[q.code] = a;
    if (b !== undefined) next[q.code] = b;
  }
  return { old, next };
}

export class ServerResponseRepo implements ResponseRepo {
  constructor(protected readonly ctx: RequestCtx) {}

  listResponses: ResponseRepo["listResponses"] = (f) =>
    guard(this.ctx, "responses.listResponses", "read", async () => {
      const auth = requireAdmin(this.ctx);
      if (!auth.ok) return auth;
      const where = and(
        branchFilter(visits.branchId, scopeOf(auth.value.user), f.branchId),
        between(jobCards.serviceDate, f.from, f.to),
        f.vehicleType ? eq(jobCards.vehicleType, f.vehicleType) : undefined,
        f.model ? eq(jobCards.model, f.model) : undefined,
        f.advisorId && UUID.test(f.advisorId) ? eq(jobCards.advisorId, f.advisorId) : undefined,
      );
      const rows = await select(this.ctx.db, where, "live", LIST_LIMIT);
      return ok(rows.map(listRowOf));
    });

  getResponse: ResponseRepo["getResponse"] = (id) =>
    guard(this.ctx, "responses.getResponse", "read", async () => {
      const found = await this.find(this.ctx.db, id, "live");
      return found.ok ? ok(detailOf(this.ctx, found.value)) : found;
    });

  editResponse: ResponseRepo["editResponse"] = (id, answers, version, s) =>
    guard(this.ctx, "responses.editResponse", "write", async () => {
      const found = await this.find(this.ctx.db, id, "live");
      if (!found.ok) return found;
      const checked = validateSubmission(answers);
      if (!checked.ok) return err("VALIDATION", "Answer every question.", checked.missing);
      const step = await verifyStepUp(this.ctx, s);
      if (!step.ok) return step;
      return this.ctx.db.transaction((tx) => this.applyEdit(tx, id, checked.answers, version));
    });

  deleteResponse: ResponseRepo["deleteResponse"] = (id, s) =>
    this.toggle(id, s, "live", "response.delete");

  restoreResponse: ResponseRepo["restoreResponse"] = (id, s) =>
    this.toggle(id, s, "deleted", "response.restore");

  listDeleted: ResponseRepo["listDeleted"] = () =>
    guard(this.ctx, "responses.listDeleted", "read", async () => {
      const auth = requireAdmin(this.ctx);
      if (!auth.ok) return auth;
      const where = branchFilter(visits.branchId, scopeOf(auth.value.user));
      const rows = await select(this.ctx.db, where, "deleted", LIST_LIMIT);
      return ok(
        rows.map((r) => {
          const at = r.response.deletedAt ?? this.ctx.clock.now();
          return {
            id: r.response.id,
            customerName: nameOf(r),
            serviceDate: r.card.serviceDate,
            deletedAt: at.toISOString(),
            branchName: r.branchName,
            purgeOn: addDays(istDateOf(at), DELETED_PURGE_DAYS),
          };
        }),
      );
    });

  /** The response in the caller's scope and state; anything else (other branch, bad id) is NOT_FOUND. */
  private async find(db: Db | Tx, id: string, mode: Mode): Promise<Result<Row>> {
    const auth = requireAdmin(this.ctx);
    if (!auth.ok) return auth;
    if (!UUID.test(id)) return err("NOT_FOUND", NOT_FOUND);
    const where = and(
      eq(responses.id, id),
      branchFilter(visits.branchId, scopeOf(auth.value.user)),
    );
    const [row] = await select(db, where, mode, 1);
    return row ? ok(row) : err("NOT_FOUND", NOT_FOUND);
  }

  /** Soft delete (live to deleted) or restore (deleted to live): password, one write, one audit. */
  private toggle(id: string, s: { password: string }, from: Mode, action: AuditAction) {
    return guard(this.ctx, `responses.${action}`, "write", async () => {
      const found = await this.find(this.ctx.db, id, from);
      if (!found.ok) return found;
      const step = await verifyStepUp(this.ctx, s);
      if (!step.ok) return step;
      const { response, visit } = found.value;
      const now = this.ctx.clock.now();
      return this.ctx.db.transaction(async (tx) => {
        const [saved] = await tx
          .update(responses)
          .set({
            deletedAt: from === "live" ? now : null,
            updatedAt: now,
            version: response.version + 1,
          })
          .where(and(eq(responses.id, id), eq(responses.version, response.version)))
          .returning({ id: responses.id });
        if (!saved) return err("CONFLICT", STALE);
        await writeAudit(this.ctx, tx, {
          action,
          entityType: "response",
          entityId: id,
          branchId: visit.branchId,
        });
        return ok(undefined);
      });
    });
  }

  private async applyEdit(
    tx: Tx,
    id: string,
    answers: AnswerMap,
    version: number,
  ): Promise<Result<ResponseDetail>> {
    const found = await this.find(tx, id, "live");
    if (!found.ok) return found;
    const row = found.value;
    if (version !== row.response.version) return err("CONFLICT", STALE);
    const { old, next } = diffAnswers(row.response.answers as AnswerMap, answers);
    if (Object.keys(old).length === 0 && Object.keys(next).length === 0) {
      return ok(detailOf(this.ctx, row));
    }
    const now = this.ctx.clock.now();
    const [saved] = await tx
      .update(responses)
      .set({ answers, updatedAt: now, version: version + 1 })
      .where(and(eq(responses.id, id), eq(responses.version, version)))
      .returning();
    if (!saved) return err("CONFLICT", STALE);
    await writeAudit(this.ctx, tx, {
      action: "response.edit",
      entityType: "response",
      entityId: id,
      branchId: row.visit.branchId,
      oldValue: old,
      newValue: next,
    });
    const alert = await this.reevaluate(tx, row, answers, now);
    return ok(detailOf(this.ctx, { ...row, response: saved, alert }));
  }

  /** SPEC F-4 step 4: re-run the alert rules on the edited answers and write what changed. */
  private async reevaluate(tx: Tx, row: Row, answers: AnswerMap, now: Date): Promise<Row["alert"]> {
    const existing = row.alert;
    const current = alertOf(existing, false);
    const ids = { id: randomUUID(), responseId: row.response.id };
    const { alert, change } = reconcileAlert(current, evaluateAlertReasons(answers), now, ids);
    if (change === "none" || alert === null) return existing;
    const values = {
      reasons: alert.reasons,
      status: alert.status,
      notes: alert.notes,
      updatedAt: now,
    };
    const branchId = row.visit.branchId;
    if (change === "created") {
      const [created] = await tx
        .insert(alerts)
        .values({ id: alert.id, responseId: alert.responseId, branchId, ...values })
        .returning();
      await this.auditAlert(tx, alert, branchId, { action: "alert.create", old: undefined });
      return created ?? existing;
    }
    const [updated] = await tx
      .update(alerts)
      .set({ ...values, version: (existing?.version ?? 0) + 1 })
      .where(eq(alerts.id, alert.id))
      .returning();
    if (change === "auto_resolved") {
      await this.auditAlert(tx, alert, branchId, { action: "alert.status", old: current?.status });
    }
    return updated ?? existing;
  }

  private async auditAlert(
    tx: Tx,
    alert: Alert,
    branchId: string,
    what: { action: AuditAction; old: string | undefined },
  ): Promise<void> {
    const resolved = what.action === "alert.status";
    await writeAudit(this.ctx, tx, {
      action: what.action,
      entityType: "alert",
      entityId: alert.id,
      branchId,
      ...(resolved ? { oldValue: { status: what.old }, note: alert.notes.at(-1)?.text ?? "" } : {}),
      newValue: { status: alert.status },
    });
  }
}
