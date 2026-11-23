import { SYSTEM_ACTOR } from "@/domain/constants";
import type { Db, Tx } from "./db/client";
import { auditLog } from "./db/schema";
import type { RequestCtx } from "./ctx";

export interface AuditInput {
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: unknown;
  newValue?: unknown;
  note?: string;
  /** Branch of the entity; defaults to the actor's branch. */
  branchId?: string | null;
  /** For events with no session yet (sign-in, lockout, cron); omit for the session user. */
  actor?: { id: string | null; name: string };
}

type Stamp = Pick<RequestCtx, "session" | "clock">;

function stampOf(
  ctx: Stamp,
  entry: AuditInput,
): { actorId: string | null; actorName: string; branchId: string | null } {
  const user = ctx.session?.user;
  const actor = entry.actor ?? { id: user?.id ?? null, name: user?.name ?? SYSTEM_ACTOR };
  const branchId = entry.branchId === undefined ? (user?.branchId ?? null) : entry.branchId;
  return { actorId: actor.id, actorName: actor.name, branchId };
}

/** Appends one audit row stamped with actor, branch and the ctx clock. Pass a `tx` to commit with the change itself. */
export async function writeAudit(ctx: Stamp, db: Db | Tx, entry: AuditInput): Promise<void> {
  await db.insert(auditLog).values({
    ...stampOf(ctx, entry),
    at: ctx.clock.now(),
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    oldValue: entry.oldValue ?? null,
    newValue: entry.newValue ?? null,
    note: entry.note ?? null,
  });
}
