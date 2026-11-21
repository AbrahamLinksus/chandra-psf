import type { AuditEntry } from "@/domain/types";
import { newId } from "../ids";

/** The only audit writer: appends to the draft's audit list and returns the new entry. */
export function appendAudit(
  draft: { audit: AuditEntry[] },
  entry: Omit<AuditEntry, "id" | "at">,
  now: Date,
): AuditEntry {
  const full: AuditEntry = { ...entry, id: newId("a"), at: now.toISOString() };
  draft.audit.push(full);
  return full;
}
