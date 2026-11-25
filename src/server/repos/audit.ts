import "server-only";
import { and, desc, eq, lt, type SQL } from "drizzle-orm";
import { ok } from "@/data/access/result";
import type { AuditEntryView, AuditRepo } from "@/data/access/repos/audit";
import { SYSTEM_ACTOR } from "@/domain/constants";
import { guard, type RequestCtx } from "../ctx";
import { auditLog, branches } from "../db/schema";
import { branchFilter, requireAdmin, scopeOf } from "../scope";

export const AUDIT_PAGE_SIZE = 100;

type Row = { log: typeof auditLog.$inferSelect; branchName: string | null };

function viewOf({ log, branchName }: Row): AuditEntryView {
  return {
    id: String(log.id),
    at: log.at.toISOString(),
    actorId: log.actorId,
    actorName: log.actorId === null && log.actorName === SYSTEM_ACTOR ? "System" : log.actorName,
    branchId: log.branchId,
    branchName,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    oldValue: log.oldValue,
    newValue: log.newValue,
    ...(log.note === null ? {} : { note: log.note }),
  };
}

export class ServerAuditRepo implements AuditRepo {
  constructor(protected readonly ctx: RequestCtx) {}

  listAudit: AuditRepo["listAudit"] = (f) =>
    guard(this.ctx, "audit.listAudit", "read", async () => {
      const auth = requireAdmin(this.ctx);
      if (!auth.ok) return auth;
      const before = f?.before === undefined ? NaN : Number(f.before);
      const where: (SQL | undefined)[] = [
        branchFilter(auditLog.branchId, scopeOf(auth.value.user), f?.branchId),
        f?.action ? eq(auditLog.action, f.action) : undefined,
        Number.isSafeInteger(before) ? lt(auditLog.id, before) : undefined,
      ];
      const rows = await this.ctx.db
        .select({ log: auditLog, branchName: branches.name })
        .from(auditLog)
        .leftJoin(branches, eq(branches.id, auditLog.branchId))
        .where(and(...where))
        .orderBy(desc(auditLog.id))
        .limit(AUDIT_PAGE_SIZE + 1);
      const page = rows.slice(0, AUDIT_PAGE_SIZE);
      const more = rows.length > AUDIT_PAGE_SIZE;
      return ok({
        entries: page.map(viewOf),
        nextCursor: more ? String(page[page.length - 1]?.log.id) : null,
      });
    });
}
