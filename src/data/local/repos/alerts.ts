import type { AlertRepo, AlertView } from "@/data/access/repos/alerts";
import { err, ok, type Result } from "@/data/access/result";
import { formatReasons } from "@/domain/alertRules";
import { TEXT_MAX_LENGTH } from "@/domain/constants";
import type { Alert, AlertStatus, User } from "@/domain/types";
import type { Db } from "../db";
import type { RepoDeps } from "../repoDeps";
import { guardRead, guardWrite } from "../results";
import { appendAudit } from "./auditWriter";

const SIGN_IN = "Sign in first";
const ADMIN_ONLY = "Only an admin can use alerts";
const NOT_FOUND = "Alert not found";

type Source = Pick<Db, "alerts" | "responses" | "visits" | "jobCards">;

/** Joins an alert to its customer and vehicle; null when its response is deleted or missing. */
function toView(alert: Alert, src: Source): AlertView | null {
  const response = src.responses.find((r) => r.id === alert.responseId);
  if (response === undefined || response.deletedAt !== null) return null;
  const visit = src.visits.find((v) => v.id === response.visitId);
  const card = visit && src.jobCards.find((j) => j.jobCardNo === visit.jobCardNo);
  if (card === undefined) return null;
  return {
    ...alert,
    customerName: card.customerName,
    phone: visit?.phone ?? card.phone,
    model: card.model,
    regNo: card.regNo,
    reasonsText: formatReasons(alert.reasons),
  };
}

/** The one "live alert" rule: its response is not deleted and still joins to a visit and job card. */
export function countOpenLiveAlerts(src: Source): number {
  return src.alerts.filter((a) => a.status === "open" && isLive(a, src)).length;
}

function isLive(alert: Alert, src: Source): boolean {
  return toView(alert, src) !== null;
}

export class LocalAlertRepo implements AlertRepo {
  constructor(protected readonly deps: RepoDeps) {}

  /** Signed-in admin, or the error result to return. */
  private admin(): User | Result<never> {
    const me = this.deps.session.current();
    if (me === null) return err("UNAUTHENTICATED", SIGN_IN);
    if (me.role !== "admin") return err("FORBIDDEN", ADMIN_ONLY);
    return me;
  }

  private source(): Source {
    const { store } = this.deps;
    return {
      alerts: store.read("alerts"),
      responses: store.read("responses"),
      visits: store.read("visits"),
      jobCards: store.read("jobCards"),
    };
  }

  readonly listAlerts: AlertRepo["listAlerts"] = (f) =>
    guardRead(async () => {
      await this.deps.store.whenReady();
      const me = this.admin();
      if ("ok" in me) return me;
      const src = this.source();
      const rows = src.alerts
        .filter((a) => f?.status === undefined || a.status === f.status)
        .flatMap((a) => toView(a, src) ?? [])
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return ok(rows);
    });

  readonly countOpen: AlertRepo["countOpen"] = () =>
    guardRead(async () => {
      await this.deps.store.whenReady();
      const me = this.admin();
      if ("ok" in me) return me;
      const src = this.source();
      return ok(countOpenLiveAlerts(src));
    });

  readonly updateAlert: AlertRepo["updateAlert"] = (id, patch) =>
    guardWrite(async () => {
      const me = this.admin();
      if ("ok" in me) return me;
      const note = patch.note?.trim();
      if (patch.status === undefined && (note === undefined || note === "")) {
        return err("VALIDATION", "Nothing to save", ["note"]);
      }
      if (note !== undefined && (note === "" || note.length > TEXT_MAX_LENGTH)) {
        return err("VALIDATION", `Note must be 1 to ${String(TEXT_MAX_LENGTH)} characters`, ["note"]);
      }
      const now = this.deps.clock.now();
      return this.deps.store.mutate(
        ["alerts", "responses", "visits", "jobCards", "audit"],
        (d): Result<AlertView> => {
          const alert = d.alerts.find((a) => a.id === id);
          if (alert === undefined || !isLive(alert, d)) return err("NOT_FOUND", NOT_FOUND);
          const actor = { actorId: me.id, actorName: me.name };
          const base = { ...actor, entityType: "alert", entityId: alert.id } as const;
          if (patch.status !== undefined && patch.status !== alert.status) {
            const old: AlertStatus = alert.status;
            alert.status = patch.status;
            appendAudit(d, { ...base, action: "alert.status", oldValue: old, newValue: patch.status }, now);
          }
          if (note !== undefined) {
            alert.notes.push({ at: now.toISOString(), by: me.name, text: note });
            appendAudit(d, { ...base, action: "alert.note", oldValue: null, newValue: note }, now);
          }
          alert.updatedAt = now.toISOString();
          const view = toView(alert, d);
          return view === null ? err("NOT_FOUND", NOT_FOUND) : ok(view);
        },
      );
    });
}
