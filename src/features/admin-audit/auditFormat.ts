import type { AuditAction } from "@/domain/types";

export const TRUNCATE_AT = 80;

export const ACTION_LABELS: Record<AuditAction, string> = {
  "link.create": "Link created",
  "link.regenerate": "Link regenerated",
  "link.cancel": "Link cancelled",
  "response.edit": "Response edited",
  "response.delete": "Response deleted",
  "response.restore": "Response restored",
  "alert.create": "Alert created",
  "alert.status": "Alert status changed",
  "alert.note": "Alert note added",
  "user.create": "User created",
  "user.deactivate": "User deactivated",
  "user.reactivate": "User reactivated",
  "user.set_password": "Password set",
};

export const ACTIONS = Object.keys(ACTION_LABELS) as AuditAction[];

/** Readable text for a stored old/new value; empty values show as a dash. */
export function formatAuditValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

export function needsTruncation(text: string): boolean {
  return text.length > TRUNCATE_AT;
}

export function truncate(text: string): string {
  return needsTruncation(text) ? `${text.slice(0, TRUNCATE_AT)}…` : text;
}
