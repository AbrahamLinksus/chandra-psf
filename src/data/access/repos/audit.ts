import type { AuditAction, AuditEntry } from "@/domain/types";
import type { Result } from "../result";

export interface AuditRepo {
  /** newest first; no write method exposed */
  listAudit(f?: { action?: AuditAction }): Promise<Result<AuditEntry[]>>;
}
