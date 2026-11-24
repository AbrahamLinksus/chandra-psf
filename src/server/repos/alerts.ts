import "server-only";
import { and, count, desc, eq, isNull, type SQL } from "drizzle-orm";
import type { AlertRepo, AlertView } from "@/data/access/repos/alerts";
import { err, ok } from "@/data/access/result";
import { formatReasons } from "@/domain/alertRules";
import type { AlertNote, AlertReason, AlertStatus } from "@/domain/types";
import { writeAudit } from "../audit";
import { guard, type RequestCtx } from "../ctx";
import type { Db, Tx } from "../db/client";
import { alerts, branches, jobCards, responses, visits } from "../db/schema";
import { branchFilter, requireAdmin, scopeOf } from "../scope";

const NO_ALERT = "That alert no longer exists.";
const STALE = "Someone else changed this alert. Reload to see the latest.";
const EMPTY = "Choose a new status or type a note.";
const ERASED = "Erased customer";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** The list shows at most this many newest alerts; older ones are not returned. */
const LIST_LIMIT = 500;

type AlertRow = typeof alerts.$inferSelect;
interface Row {
  alert: AlertRow;
  card: typeof jobCards.$inferSelect;
  branchName: string;
}

/** Alerts of live (not deleted) responses, with their job card and branch name. */
function select(db: Db | Tx, where: SQL | undefined, limit: number): Promise<Row[]> {
  return db
    .select({ alert: alerts, card: jobCards, branchName: branches.name })
    .from(alerts)
    .innerJoin(responses, eq(responses.id, alerts.responseId))
    .innerJoin(visits, eq(visits.id, responses.visitId))
    .innerJoin(jobCards, eq(jobCards.id, visits.jobCardId))
    .innerJoin(branches, eq(branches.id, alerts.branchId))
    .where(and(isNull(responses.deletedAt), where))
    .orderBy(desc(alerts.createdAt))
    .limit(limit);
}

function viewOf({ alert, card, branchName }: Row): AlertView {
  const reasons = alert.reasons as AlertReason[];
  const erased = card.erasedAt !== null;
  return {
    id: alert.id,
    responseId: alert.responseId,
    reasons,
    status: alert.status,
    notes: erased ? [] : (alert.notes as AlertNote[]),
    createdAt: alert.createdAt.toISOString(),
    updatedAt: alert.updatedAt.toISOString(),
    customerName: erased || card.customerName === null ? ERASED : card.customerName,
    phone: erased ? null : card.phone,
    model: card.model,
    regNo: erased ? "" : (card.regNo ?? ""),
    reasonsText: formatReasons(reasons),
    branchName,
    version: alert.version,
  };
}

export class ServerAlertRepo implements AlertRepo {
  constructor(protected readonly ctx: RequestCtx) {}

  listAlerts: AlertRepo["listAlerts"] = (f) =>
    guard(this.ctx, "alerts.listAlerts", "read", async () => {
      const auth = requireAdmin(this.ctx);
      if (!auth.ok) return auth;
      const where = and(
        branchFilter(alerts.branchId, scopeOf(auth.value.user), f?.branchId),
        f?.status ? eq(alerts.status, f.status) : undefined,
      );
      const rows = await select(this.ctx.db, where, LIST_LIMIT);
      return ok(rows.map(viewOf));
    });

  countOpen: AlertRepo["countOpen"] = () =>
    guard(this.ctx, "alerts.countOpen", "read", async () => {
      const auth = requireAdmin(this.ctx);
      if (!auth.ok) return auth;
      const [row] = await this.ctx.db
        .select({ n: count() })
        .from(alerts)
        .innerJoin(responses, eq(responses.id, alerts.responseId))
        .where(
          and(
            isNull(responses.deletedAt),
            eq(alerts.status, "open"),
            branchFilter(alerts.branchId, scopeOf(auth.value.user)),
          ),
        );
      return ok(row?.n ?? 0);
    });

  updateAlert: AlertRepo["updateAlert"] = (id, patch, version) =>
    guard(this.ctx, "alerts.updateAlert", "write", async () => {
      const auth = requireAdmin(this.ctx);
      if (!auth.ok) return auth;
      const { user } = auth.value;
      const note = patch.note?.trim() ?? "";
      if (patch.status === undefined && note === "") return err("VALIDATION", EMPTY);
      if (!UUID.test(id)) return err("NOT_FOUND", NO_ALERT);
      return this.ctx.db.transaction(async (tx) => {
        const where = and(eq(alerts.id, id), branchFilter(alerts.branchId, scopeOf(user)));
        const [row] = await select(tx, where, 1);
        if (!row) return err("NOT_FOUND", NO_ALERT);
        const cur = row.alert;
        if (version !== cur.version) return err("CONFLICT", STALE);
        if (note === "" && patch.status === cur.status) return ok(viewOf(row));
        const now = this.ctx.clock.now();
        const added = { at: now.toISOString(), by: user.name, text: note };
        const notes = note === "" ? cur.notes : [...(cur.notes as AlertNote[]), added];
        const [saved] = await tx
          .update(alerts)
          .set({
            status: patch.status ?? cur.status,
            notes,
            updatedAt: now,
            version: cur.version + 1,
          })
          .where(and(eq(alerts.id, id), eq(alerts.version, cur.version)))
          .returning();
        if (!saved) return err("CONFLICT", STALE);
        await this.audit(tx, saved, cur.status, note);
        return ok(viewOf({ ...row, alert: saved }));
      });
    });

  /** alert.status (old to new, with the note) when the status moved, else alert.note. */
  private async audit(tx: Tx, saved: AlertRow, before: AlertStatus, note: string): Promise<void> {
    const moved = saved.status !== before;
    if (!moved && note === "") return;
    await writeAudit(this.ctx, tx, {
      action: moved ? "alert.status" : "alert.note",
      entityType: "alert",
      entityId: saved.id,
      branchId: saved.branchId,
      ...(moved ? { oldValue: { status: before }, newValue: { status: saved.status } } : {}),
      ...(note === "" ? {} : { note }),
    });
  }
}
