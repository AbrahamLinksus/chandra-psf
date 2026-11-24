import "server-only";
import { and, desc, eq, isNull, type SQL } from "drizzle-orm";
import type { LinkIssued, VisitSummary } from "@/data/access/repos/visits";
import { buildWhatsAppUrl } from "@/domain/whatsapp";
import { visitStatus } from "@/domain/visitStatus";
import type { RequestCtx } from "../ctx";
import { jobCards, users, visits } from "../db/schema";
import { linkUrl } from "../tokens";

export type VisitRow = typeof visits.$inferSelect;
export type CardRow = typeof jobCards.$inferSelect;

/** A visit with its job card and the name of whoever created the link. */
export interface VisitRecord {
  visit: VisitRow;
  card: CardRow;
  creatorName: string;
}

export const LIST_LIMIT = 200;

export async function loadRecords(
  ctx: Pick<RequestCtx, "db">,
  where: SQL | undefined,
  limit: number,
): Promise<VisitRecord[]> {
  const rows = await ctx.db
    .select({ visit: visits, card: jobCards, creatorName: users.name })
    .from(visits)
    .innerJoin(jobCards, eq(jobCards.id, visits.jobCardId))
    .innerJoin(users, eq(users.id, visits.createdBy))
    .where(where)
    .orderBy(desc(visits.createdAt))
    .limit(limit);
  return rows;
}

export function summaryOf(rec: VisitRecord, now: Date, userId: string): VisitSummary {
  const { visit: v, card } = rec;
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
    jobCardId: card.id,
    jobCardNo: card.jobCardNo,
    customerName: card.customerName,
    regNo: card.regNo,
    model: card.model,
    serviceDate: card.serviceDate,
    phone: card.phone,
    status,
    createdAt: v.createdAt.toISOString(),
    expiresAt: v.expiresAt.toISOString(),
    createdByName: rec.creatorName,
    mine: v.createdBy === userId,
  };
}

/** The summary plus the one-time URL and WhatsApp link built from `code`. */
export function issuedOf(rec: VisitRecord, code: string, now: Date, userId: string): LinkIssued {
  const url = linkUrl(code);
  const { card } = rec;
  return {
    visit: summaryOf(rec, now, userId),
    url,
    whatsappUrl: buildWhatsAppUrl(card.phone, {
      name: card.customerName ?? "",
      model: card.model,
      regNo: card.regNo ?? "",
      url,
    }),
  };
}

/** The job card's current link (not replaced), for the job card screen. */
export async function currentSummary(
  ctx: Pick<RequestCtx, "db" | "clock">,
  jobCardId: string,
  userId: string,
): Promise<VisitSummary | null> {
  const [rec] = await loadRecords(
    ctx,
    and(eq(visits.jobCardId, jobCardId), isNull(visits.replacedBy)),
    1,
  );
  return rec ? summaryOf(rec, ctx.clock.now(), userId) : null;
}
