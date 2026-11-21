import type { Visit, VisitStatus } from "./types";

/** cancelled > completed > expired (replaced or past expiry) > opened > created. */
export function visitStatus(v: Visit, now: Date): VisitStatus {
  if (v.cancelledAt !== null) return "cancelled";
  if (v.completedAt !== null) return "completed";
  if (v.replacedBy !== null || now.getTime() > new Date(v.expiresAt).getTime()) return "expired";
  if (v.openedAt !== null) return "opened";
  return "created";
}
