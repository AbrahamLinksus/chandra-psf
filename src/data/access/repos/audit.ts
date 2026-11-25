import type { AuditEntry } from "@/domain/types";
import type { Result } from "../result";

/** One audit row as the admin screen shows it. */
export interface AuditEntryView extends Omit<AuditEntry, "actorId" | "entityType" | "action"> {
  actorId: string | null;
  /** "System" for entries written by the system itself */
  actorName: string;
  branchId: string | null;
  branchName: string | null;
  /** any AuditAction; kept a string so new actions list without a contract change */
  action: string;
  entityType: string;
}

export interface AuditPage {
  entries: AuditEntryView[];
  /** pass as `before` to get the next page; null on the last page */
  nextCursor: string | null;
}

export interface AuditRepo {
  /**
   * Newest first, 100 per page, admins only. A branch admin sees only their branch;
   * `branchId` narrows a main admin only. No write method is exposed.
   */
  listAudit(f?: { action?: string; branchId?: string; before?: string }): Promise<Result<AuditPage>>;
}
