import "server-only";
import { and, eq, isNull, like, or, sql, type SQL } from "drizzle-orm";
import type { VisitRepo } from "@/data/access/repos/visits";
import { err, ok } from "@/data/access/result";
import { LINK_EXPIRY_DAYS } from "@/domain/constants";
import { writeAudit } from "../audit";
import { guard, type RequestCtx, type SessionUser } from "../ctx";
import type { Tx } from "../db/client";
import { jobCards, linkTokens, visits } from "../db/schema";
import { branchFilter, inScope, requireStaff, scopeOf } from "../scope";
import { newLinkCode } from "../tokens";
import {
  issuedOf,
  LIST_LIMIT,
  loadRecords,
  summaryOf,
  type CardRow,
  type VisitRecord,
} from "./visitRows";

const NO_LINK = "That link no longer exists.";
const NO_CARD = "That job card no longer exists.";
const ERASED = "This customer's data has been erased.";
const DONE = "Feedback already received";
const EXISTS = "A feedback link already exists for this job card.";
const CHANGED = "This link can no longer be changed";
const EXPIRED = "This link has expired. Regenerate it instead.";
const DAY_MS = 86_400_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Created or opened, and not replaced: the link can still be acted on. */
function isChangeable(v: VisitRecord["visit"]): boolean {
  return v.completedAt === null && v.cancelledAt === null && v.replacedBy === null;
}

function searchFilter(search: string | undefined): SQL | undefined {
  const key = (search ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (key === "") return undefined;
  return or(like(jobCards.jobCardKey, `%${key}%`), like(jobCards.regNoKey, `%${key}%`));
}

/** Marks every live code of the visit as superseded. */
async function supersedeTokens(tx: Tx, visitId: string, at: Date): Promise<void> {
  await tx
    .update(linkTokens)
    .set({ supersededAt: at })
    .where(and(eq(linkTokens.visitId, visitId), isNull(linkTokens.supersededAt)));
}

/** Supersedes any live code of the visit and stores the hash of a new one; returns the code. */
async function issueCode(
  tx: Tx,
  ctx: RequestCtx,
  visitId: string,
  userId: string,
): Promise<string> {
  const { code, hash } = newLinkCode();
  await supersedeTokens(tx, visitId, ctx.clock.now());
  await tx
    .insert(linkTokens)
    .values({ tokenHash: hash, visitId, createdBy: userId, createdAt: ctx.clock.now() });
  return code;
}

async function lockCard(tx: Tx, jobCardId: string): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`link:${jobCardId}`}))`);
}

export class ServerVisitRepo implements VisitRepo {
  constructor(protected readonly ctx: RequestCtx) {}

  listVisits: VisitRepo["listVisits"] = (q) =>
    guard(this.ctx, "visits.listVisits", "read", async () => {
      const auth = requireStaff(this.ctx);
      if (!auth.ok) return auth;
      const { user } = auth.value;
      const where = and(
        isNull(visits.replacedBy),
        branchFilter(visits.branchId, scopeOf(user)),
        q.scope === "mine" ? eq(visits.createdBy, user.id) : undefined,
        searchFilter(q.search),
      );
      const rows = await loadRecords(this.ctx, where, LIST_LIMIT);
      const now = this.ctx.clock.now();
      return ok(rows.map((r) => summaryOf(r, now, user.id)));
    });

  createVisitLink: VisitRepo["createVisitLink"] = (i) =>
    guard(this.ctx, "visits.createVisitLink", "write", async () => {
      const auth = requireStaff(this.ctx);
      if (!auth.ok) return auth;
      const { user } = auth.value;
      const card = await this.loadCard(user, i.jobCardId);
      if (!card) return err("NOT_FOUND", NO_CARD);
      if (card.erasedAt !== null) return err("VALIDATION", ERASED);
      return this.ctx.db.transaction((tx) => this.createIn(tx, user, card));
    });

  resendLink: VisitRepo["resendLink"] = (visitId) =>
    guard(this.ctx, "visits.resendLink", "write", async () => {
      const auth = requireStaff(this.ctx);
      if (!auth.ok) return auth;
      const { user } = auth.value;
      return this.ctx.db.transaction(async (tx) => {
        const rec = await this.lockedRecord(tx, user, visitId);
        if (!rec) return err("NOT_FOUND", NO_LINK);
        if (!isChangeable(rec.visit)) return err("CONFLICT", CHANGED);
        if (rec.card.erasedAt !== null) return err("VALIDATION", ERASED);
        if (this.ctx.clock.now() > rec.visit.expiresAt) return err("CONFLICT", EXPIRED);
        const code = await issueCode(tx, this.ctx, rec.visit.id, user.id);
        await this.audit(tx, "link.resend", rec.visit);
        return ok(issuedOf(rec, code, this.ctx.clock.now(), user.id));
      });
    });

  regenerateLink: VisitRepo["regenerateLink"] = (visitId) =>
    guard(this.ctx, "visits.regenerateLink", "write", async () => {
      const auth = requireStaff(this.ctx);
      if (!auth.ok) return auth;
      const { user } = auth.value;
      return this.ctx.db.transaction(async (tx) => {
        const rec = await this.lockedRecord(tx, user, visitId);
        if (!rec) return err("NOT_FOUND", NO_LINK);
        if (!isChangeable(rec.visit)) return err("CONFLICT", CHANGED);
        if (rec.card.erasedAt !== null) return err("VALIDATION", ERASED);
        const fresh = await this.insertVisit(tx, user, rec.card);
        await tx.update(visits).set({ replacedBy: fresh.id }).where(eq(visits.id, rec.visit.id));
        await supersedeTokens(tx, rec.visit.id, this.ctx.clock.now());
        const code = await issueCode(tx, this.ctx, fresh.id, user.id);
        await this.audit(tx, "link.regenerate", fresh, { replaced: rec.visit.id });
        return ok(
          issuedOf(
            { ...rec, visit: fresh, creatorName: user.name },
            code,
            this.ctx.clock.now(),
            user.id,
          ),
        );
      });
    });

  cancelLink: VisitRepo["cancelLink"] = (visitId) =>
    guard(this.ctx, "visits.cancelLink", "write", async () => {
      const auth = requireStaff(this.ctx);
      if (!auth.ok) return auth;
      const { user } = auth.value;
      return this.ctx.db.transaction(async (tx) => {
        const rec = await this.lockedRecord(tx, user, visitId);
        if (!rec) return err("NOT_FOUND", NO_LINK);
        if (!isChangeable(rec.visit)) return err("CONFLICT", CHANGED);
        const now = this.ctx.clock.now();
        await tx.update(visits).set({ cancelledAt: now }).where(eq(visits.id, rec.visit.id));
        await supersedeTokens(tx, rec.visit.id, now);
        await this.audit(tx, "link.cancel", rec.visit);
        const cancelled = { ...rec, visit: { ...rec.visit, cancelledAt: now } };
        return ok(summaryOf(cancelled, now, user.id));
      });
    });

  private async createIn(tx: Tx, user: SessionUser, card: CardRow) {
    await lockCard(tx, card.id);
    const existing = await tx.select().from(visits).where(eq(visits.jobCardId, card.id));
    if (existing.some((v) => v.completedAt !== null)) return err("ALREADY_COMPLETED", DONE);
    const live = existing.find((v) => v.replacedBy === null && v.cancelledAt === null);
    if (live) return err("CONFLICT", EXISTS);
    const fresh = await this.insertVisit(tx, user, card);
    const cancelled = existing.find((v) => v.replacedBy === null);
    if (cancelled) {
      await tx.update(visits).set({ replacedBy: fresh.id }).where(eq(visits.id, cancelled.id));
    }
    const code = await issueCode(tx, this.ctx, fresh.id, user.id);
    await this.audit(tx, "link.create", fresh);
    const rec = { visit: fresh, card, creatorName: user.name };
    return ok(issuedOf(rec, code, this.ctx.clock.now(), user.id));
  }

  private async insertVisit(tx: Tx, user: SessionUser, card: CardRow) {
    const now = this.ctx.clock.now();
    const [row] = await tx
      .insert(visits)
      .values({
        jobCardId: card.id,
        branchId: card.branchId,
        createdBy: user.id,
        createdAt: now,
        expiresAt: new Date(now.getTime() + LINK_EXPIRY_DAYS * DAY_MS),
      })
      .returning();
    if (!row) throw new Error("insert returned no row");
    return row;
  }

  private async audit(
    tx: Tx,
    action: string,
    visit: VisitRecord["visit"],
    newValue?: unknown,
  ): Promise<void> {
    await writeAudit(this.ctx, tx, {
      action,
      entityType: "visit",
      entityId: visit.id,
      branchId: visit.branchId,
      ...(newValue === undefined ? {} : { newValue }),
    });
  }

  /** The card, in the caller's branch scope (erased cards included). */
  private async loadCard(user: SessionUser, id: string): Promise<CardRow | undefined> {
    if (!UUID.test(id)) return undefined;
    const [row] = await this.ctx.db
      .select()
      .from(jobCards)
      .where(and(eq(jobCards.id, id), branchFilter(jobCards.branchId, scopeOf(user))))
      .limit(1);
    return row;
  }

  /** Takes the card's link lock, then reads the visit so concurrent changes line up. */
  private async lockedRecord(
    tx: Tx,
    user: SessionUser,
    visitId: string,
  ): Promise<VisitRecord | undefined> {
    if (!UUID.test(visitId)) return undefined;
    const [probe] = await loadRecords({ db: tx }, eq(visits.id, visitId), 1);
    if (!probe || !inScope(scopeOf(user), probe.visit.branchId)) return undefined;
    await lockCard(tx, probe.card.id);
    const [rec] = await loadRecords({ db: tx }, eq(visits.id, visitId), 1);
    return rec;
  }
}
