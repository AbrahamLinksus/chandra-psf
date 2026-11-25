import "server-only";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import type { CustomerRepo } from "@/data/access";
import type { CustomerRow } from "@/data/access/repos/customers";
import { err, ok } from "@/data/access/result";
import { QUESTIONNAIRE_V1 } from "@/domain/questionnaire";
import type { AnswerValue, VisitStatus } from "@/domain/types";
import { visitStatus } from "@/domain/visitStatus";
import { verifyStepUp } from "../auth/stepUp";
import { writeAudit } from "../audit";
import { toCsv } from "../csv";
import { guard, type RequestCtx } from "../ctx";
import { branches, jobCards, responses, visits } from "../db/schema";
import { eraseJobCards, logErasure } from "../erasure";
import { requireMainAdmin } from "../scope";

const PHONE_KEY_LENGTH = 10;
const MAX_ROWS = 200;

type Found = { card: typeof jobCards.$inferSelect; branchName: string };
type VisitRow = typeof visits.$inferSelect;
type VisitInfo = {
  status: VisitStatus;
  submittedAt: Date | null;
  answers: Record<string, AnswerValue> | null;
};

function cellOf(v: AnswerValue | undefined): string {
  if (v === undefined) return "";
  if (typeof v !== "object") return String(v);
  return [...v.options, ...(v.text ? [v.text] : [])].join("; ");
}

function statusOf(v: VisitRow, now: Date): VisitStatus {
  const iso = (d: Date | null): string | null => d?.toISOString() ?? null;
  return visitStatus(
    {
      id: v.id,
      jobCardNo: "",
      phone: null,
      token: "",
      createdBy: v.createdBy,
      createdAt: v.createdAt.toISOString(),
      expiresAt: v.expiresAt.toISOString(),
      openedAt: iso(v.openedAt),
      completedAt: iso(v.completedAt),
      cancelledAt: iso(v.cancelledAt),
      replacedBy: v.replacedBy,
    },
    now,
  );
}

type ResponseRow = typeof responses.$inferSelect | null;

function infoOf(v: VisitRow, resp: ResponseRow, now: Date): VisitInfo {
  return {
    status: statusOf(v, now),
    submittedAt: resp?.submittedAt ?? null,
    answers: (resp?.answers as Record<string, AnswerValue> | undefined) ?? null,
  };
}

function exportRows(cards: Found[], info: Map<string, VisitInfo>): (string | null)[][] {
  const codes = QUESTIONNAIRE_V1.questions.map((x) => x.code);
  const head = [
    ...["Branch", "Job card", "Service date", "Name", "Phone", "Reg. no", "Model"],
    ...["Link status", "Submitted at", ...codes],
  ];
  const body = cards.map(({ card, branchName }) => {
    const i = info.get(card.id);
    return [
      ...[branchName, card.jobCardNo, card.serviceDate, card.customerName, card.phone],
      ...[card.regNo, card.model, i?.status ?? "", i?.submittedAt?.toISOString() ?? ""],
      ...codes.map((c) => cellOf(i?.answers?.[c])),
    ];
  });
  return [head, ...body];
}

function searchCondition(q: { phone?: string; regNo?: string }) {
  const phone = q.phone?.replace(/\D/g, "").slice(-PHONE_KEY_LENGTH);
  const reg = q.regNo?.replace(/\s+/g, "").toUpperCase();
  if (phone && phone.length < PHONE_KEY_LENGTH) {
    return err("VALIDATION", "Enter the full 10-digit number.", ["phone"]);
  }
  if (phone) return ok(eq(jobCards.phoneKey, phone));
  if (reg) return ok(eq(jobCards.regNoKey, reg));
  return err("VALIDATION", "Enter a phone number or registration number.");
}

export class ServerCustomerRepo implements CustomerRepo {
  constructor(protected readonly ctx: RequestCtx) {}

  /** Latest visit per job card, with its live response. */
  private async visitInfo(ids: string[]): Promise<Map<string, VisitInfo>> {
    const rows = await this.ctx.db
      .select({ visit: visits, resp: responses })
      .from(visits)
      .leftJoin(responses, and(eq(responses.visitId, visits.id), isNull(responses.deletedAt)))
      .where(inArray(visits.jobCardId, ids))
      .orderBy(desc(visits.createdAt));
    const out = new Map<string, VisitInfo>();
    const now = this.ctx.clock.now();
    for (const { visit, resp } of rows) {
      if (!out.has(visit.jobCardId)) out.set(visit.jobCardId, infoOf(visit, resp, now));
    }
    return out;
  }

  private async load(ids: string[]): Promise<Found[]> {
    return this.ctx.db
      .select({ card: jobCards, branchName: branches.name })
      .from(jobCards)
      .innerJoin(branches, eq(branches.id, jobCards.branchId))
      .where(inArray(jobCards.id, ids))
      .orderBy(desc(jobCards.serviceDate));
  }

  searchCustomers: CustomerRepo["searchCustomers"] = (q) =>
    guard(this.ctx, "customers.searchCustomers", "read", async () => {
      const auth = requireMainAdmin(this.ctx);
      if (!auth.ok) return auth;
      const cond = searchCondition(q);
      if (!cond.ok) return cond;
      const found = await this.ctx.db
        .select({ id: jobCards.id })
        .from(jobCards)
        .where(and(cond.value, isNull(jobCards.erasedAt)))
        .limit(MAX_ROWS);
      if (found.length === 0) return ok([]);
      const ids = found.map((f) => f.id);
      const [cards, info] = await Promise.all([this.load(ids), this.visitInfo(ids)]);
      const rows: CustomerRow[] = cards.map(({ card, branchName }) => ({
        jobCardId: card.id,
        branchName,
        serviceDate: card.serviceDate,
        customerName: card.customerName,
        regNo: card.regNo,
        linkStatus: info.get(card.id)?.status ?? null,
        hasResponse: info.get(card.id)?.answers != null,
        erased: false,
      }));
      return ok(rows);
    });

  exportCustomers: CustomerRepo["exportCustomers"] = (jobCardIds) =>
    guard(this.ctx, "customers.exportCustomers", "write", async () => {
      const auth = requireMainAdmin(this.ctx);
      if (!auth.ok) return auth;
      const ids = [...new Set(jobCardIds)];
      if (ids.length === 0) return err("VALIDATION", "Tick at least one customer.");
      const cards = (await this.load(ids)).filter((c) => c.card.erasedAt == null);
      if (cards.length === 0) return err("NOT_FOUND", "No customer found.");
      const info = await this.visitInfo(cards.map((c) => c.card.id));
      await writeAudit(this.ctx, this.ctx.db, {
        action: "customer.export",
        entityType: "customer",
        entityId: "export",
        newValue: { count: cards.length },
        branchId: null,
      });
      const day = this.ctx.clock.now().toISOString().slice(0, 10);
      return ok({ filename: `customers-${day}.csv`, csv: toCsv(exportRows(cards, info)) });
    });

  eraseCustomers: CustomerRepo["eraseCustomers"] = (jobCardIds, s) =>
    guard(this.ctx, "customers.eraseCustomers", "write", async () => {
      const auth = requireMainAdmin(this.ctx);
      if (!auth.ok) return auth;
      const ids = [...new Set(jobCardIds)];
      if (ids.length === 0) return err("VALIDATION", "Tick at least one customer.");
      const step = await verifyStepUp(this.ctx, s);
      if (!step.ok) return step;
      const erased = await this.ctx.db.transaction(async (tx) => {
        const done = await eraseJobCards(tx, ids, "request", this.ctx.clock.now());
        if (done.length === 0) return done;
        await writeAudit(this.ctx, tx, {
          action: "customer.erase",
          entityType: "customer",
          entityId: "erase",
          newValue: { count: done.length },
          branchId: null,
        });
        return done;
      });
      if (erased.length === 0) return err("NOT_FOUND", "No customer found.");
      logErasure("request", erased);
      return ok({ erased: erased.length });
    });
}
