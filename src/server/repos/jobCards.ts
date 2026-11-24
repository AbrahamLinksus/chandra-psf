import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { VisitSummary } from "@/data/access";
import type { JobCardInput, JobCardRepo, JobCardView } from "@/data/access/repos/jobCards";
import { err, ok, type Result } from "@/data/access/result";
import { normalizeJobCardNo } from "@/domain/jobCard";
import { istDateOf } from "@/domain/time";
import { visitStatus } from "@/domain/visitStatus";
import { writeAudit } from "../audit";
import { guard, type RequestCtx, type SessionUser } from "../ctx";
import { advisors, branches, jobCards, visits } from "../db/schema";
import { branchFilter, requireStaff, scopeOf } from "../scope";
import { isUniqueViolation } from "./branches";
import {
  ACCOUNT_DISABLED,
  columnsOf,
  diffColumns,
  existsMessage,
  inputOf,
  NO_ADVISORS,
  NOT_EDITABLE,
  notFoundMessage,
  parseInput,
  type JobCardColumns,
  type JobCardRow,
} from "./jobCardRules";
import { unavailable } from "./unavailable";

const NO_CARD = "That job card no longer exists.";
const PICK_ADVISOR = "Pick an advisor";
type VisitRow = typeof visits.$inferSelect;

function toSummary(card: JobCardRow, v: VisitRow, now: Date, userId: string): VisitSummary {
  const status = visitStatus(
    {
      id: v.id,
      jobCardNo: card.jobCardNo,
      phone: card.phone,
      token: "",
      createdBy: v.createdBy,
      createdAt: v.createdAt.toISOString(),
      expiresAt: v.expiresAt.toISOString(),
      openedAt: v.openedAt?.toISOString() ?? null,
      completedAt: v.completedAt?.toISOString() ?? null,
      cancelledAt: v.cancelledAt?.toISOString() ?? null,
      replacedBy: v.replacedBy,
    },
    now,
  );
  return {
    id: v.id,
    jobCardNo: card.jobCardNo,
    customerName: card.customerName ?? "",
    regNo: card.regNo ?? "",
    model: card.model,
    serviceDate: card.serviceDate,
    phone: card.phone,
    status,
    createdAt: v.createdAt.toISOString(),
    expiresAt: v.expiresAt.toISOString(),
    url: "",
    whatsappUrl: null,
    isMine: v.createdBy === userId,
  };
}

export class ServerJobCardRepo implements JobCardRepo {
  constructor(protected readonly ctx: RequestCtx) {}

  getJobCard: JobCardRepo["getJobCard"] = (typed) =>
    guard(this.ctx, "jobCards.getJobCard", "read", async () => {
      const auth = requireStaff(this.ctx);
      if (!auth.ok) return auth;
      const { user } = auth.value;
      const key = normalizeJobCardNo(typed);
      const [row] = await this.ctx.db
        .select()
        .from(jobCards)
        .where(
          and(
            eq(jobCards.jobCardKey, key),
            isNull(jobCards.erasedAt),
            branchFilter(jobCards.branchId, scopeOf(user)),
          ),
        )
        .limit(1);
      if (key === "" || !row) return err("NOT_FOUND", notFoundMessage(typed));
      const view = await this.view(row);
      const [visit] = await this.ctx.db
        .select()
        .from(visits)
        .where(and(eq(visits.jobCardId, row.id), isNull(visits.replacedBy)))
        .orderBy(desc(visits.createdAt))
        .limit(1);
      const current = visit ? toSummary(row, visit, this.ctx.clock.now(), user.id) : null;
      return ok({ jobCard: view, current });
    });

  createJobCard: JobCardRepo["createJobCard"] = (input) =>
    guard(this.ctx, "jobCards.createJobCard", "write", async () => {
      const auth = requireStaff(this.ctx);
      if (!auth.ok) return auth;
      const { user } = auth.value;
      const { requestId, ...raw } = input;
      const saved = await this.byRequest(requestId, user);
      if (saved) return ok(await this.view(saved));
      const branch = await this.activeBranch(user);
      if (!branch.ok) return branch;
      const parsed = parseInput(raw, this.ctx.clock.now());
      if (!parsed.ok) return parsed;
      const cols = columnsOf(parsed.value);
      const advisor = await this.checkAdvisor(branch.value, cols.advisorId);
      if (!advisor.ok) return advisor;
      return this.insert(user, branch.value, requestId, cols);
    });

  updateJobCard: JobCardRepo["updateJobCard"] = (id, patch) =>
    guard(this.ctx, "jobCards.updateJobCard", "write", async () => {
      const auth = requireStaff(this.ctx);
      if (!auth.ok) return auth;
      const before = await this.load(auth.value.user, id);
      if (!before) return err("NOT_FOUND", NO_CARD);
      if (!(await this.isEditable(before))) return err("CONFLICT", NOT_EDITABLE);
      const next = this.merge(before, patch);
      if (!next.ok) return next;
      if (patch.advisorId !== undefined) {
        const advisor = await this.checkAdvisor(before.branchId, next.value.advisorId);
        if (!advisor.ok) return advisor;
      }
      return this.apply(before, next.value);
    });

  listFreshJobCards: JobCardRepo["listFreshJobCards"] = () => unavailable();

  /** Stored card plus the patch, re-validated as a whole; an untouched old service date stays valid. */
  private merge(before: JobCardRow, patch: Partial<JobCardInput>): Result<JobCardColumns> {
    const now = this.ctx.clock.now();
    const changed = patch;
    const parsed = parseInput(
      { ...inputOf(before), ...changed, serviceDate: changed.serviceDate ?? istDateOf(now) },
      now,
    );
    if (!parsed.ok) return parsed;
    const cols = columnsOf(parsed.value);
    return ok(
      changed.serviceDate === undefined ? { ...cols, serviceDate: before.serviceDate } : cols,
    );
  }

  private async apply(before: JobCardRow, cols: JobCardColumns): Promise<Result<JobCardView>> {
    const diff = diffColumns(before, cols);
    if (diff === null) return ok(await this.view(before));
    try {
      const row = await this.ctx.db.transaction(async (tx) => {
        const [updated] = await tx
          .update(jobCards)
          .set({ ...cols, updatedAt: this.ctx.clock.now() })
          .where(eq(jobCards.id, before.id))
          .returning();
        if (!updated) throw new Error("update returned no row");
        await writeAudit(this.ctx, tx, {
          action: "jobcard.update",
          entityType: "job_card",
          entityId: before.id,
          branchId: before.branchId,
          oldValue: diff.old,
          newValue: diff.next,
        });
        return updated;
      });
      return ok(await this.view(row));
    } catch (e) {
      if (isUniqueViolation(e))
        return err("CONFLICT", existsMessage(cols.jobCardNo), ["jobCardNo"]);
      throw e;
    }
  }

  private async insert(
    user: SessionUser,
    branchId: string,
    requestId: string,
    cols: JobCardColumns,
  ): Promise<Result<JobCardView>> {
    try {
      const row = await this.ctx.db.transaction(async (tx) => {
        const [created] = await tx
          .insert(jobCards)
          .values({ ...cols, branchId, createdBy: user.id, createRequestId: requestId })
          .returning();
        if (!created) throw new Error("insert returned no row");
        await writeAudit(this.ctx, tx, {
          action: "jobcard.create",
          entityType: "job_card",
          entityId: created.id,
          branchId,
          newValue: { jobCardNo: cols.jobCardNo, model: cols.model, serviceDate: cols.serviceDate },
        });
        return created;
      });
      return ok(await this.view(row));
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
      // A parallel retry of the same request wins the race: return its card.
      const saved = await this.byRequest(requestId, user);
      if (saved) return ok(await this.view(saved));
      return err("CONFLICT", existsMessage(cols.jobCardNo), ["jobCardNo"]);
    }
  }

  /** A card this user already saved under this request id (a retry after a lost reply). */
  private async byRequest(requestId: string, user: SessionUser): Promise<JobCardRow | undefined> {
    const [row] = await this.ctx.db
      .select()
      .from(jobCards)
      .where(eq(jobCards.createRequestId, requestId))
      .limit(1);
    return row && row.createdBy === user.id ? row : undefined;
  }

  private async activeBranch(user: SessionUser): Promise<Result<string>> {
    if (user.branchId === null) return err("FORBIDDEN", "You can't do that.");
    const [branch] = await this.ctx.db
      .select({ active: branches.active })
      .from(branches)
      .where(eq(branches.id, user.branchId))
      .limit(1);
    return branch?.active ? ok(user.branchId) : err("FORBIDDEN", ACCOUNT_DISABLED);
  }

  private async checkAdvisor(branchId: string, advisorId: string): Promise<Result<true>> {
    const rows = await this.ctx.db
      .select({ id: advisors.id })
      .from(advisors)
      .where(and(eq(advisors.branchId, branchId), eq(advisors.active, true)));
    if (rows.length === 0) return err("VALIDATION", NO_ADVISORS, ["advisorId"]);
    if (!rows.some((r) => r.id === advisorId))
      return err("VALIDATION", PICK_ADVISOR, ["advisorId"]);
    return ok(true);
  }

  /** The card, when it exists, is not erased and is in the caller's scope. */
  private async load(user: SessionUser, id: string): Promise<JobCardRow | undefined> {
    const [row] = await this.ctx.db
      .select()
      .from(jobCards)
      .where(
        and(
          eq(jobCards.id, id),
          isNull(jobCards.erasedAt),
          branchFilter(jobCards.branchId, scopeOf(user)),
        ),
      )
      .limit(1);
    return row;
  }

  private async isEditable(row: JobCardRow): Promise<boolean> {
    return row.erasedAt === null && !(await this.hasCompletedVisit(row.id));
  }

  private async hasCompletedVisit(jobCardId: string): Promise<boolean> {
    const rows = await this.ctx.db
      .select({ completedAt: visits.completedAt })
      .from(visits)
      .where(eq(visits.jobCardId, jobCardId));
    return rows.some((r) => r.completedAt !== null);
  }

  private async view(row: JobCardRow): Promise<JobCardView> {
    const [names] = await this.ctx.db
      .select({ advisorName: advisors.name, branchName: branches.name })
      .from(advisors)
      .innerJoin(branches, eq(branches.id, row.branchId))
      .where(eq(advisors.id, row.advisorId))
      .limit(1);
    return {
      id: row.id,
      jobCardNo: row.jobCardNo,
      customerName: row.customerName ?? "",
      phone: row.phone,
      regNo: row.regNo ?? "",
      model: row.model,
      vehicleType: row.vehicleType,
      serviceType: row.serviceType,
      serviceDate: row.serviceDate,
      advisorId: row.advisorId,
      advisorName: names?.advisorName ?? "",
      branchName: names?.branchName ?? "",
      editable: await this.isEditable(row),
    };
  }
}
