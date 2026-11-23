import { eq, type AnyColumn, type SQL } from "drizzle-orm";
import { err, ok, type Result } from "@/data/access/result";
import { isAdmin, isMainAdmin, type StaffRole } from "@/domain/roles";
import type { RequestCtx, Scope, SessionInfo, SessionUser } from "./ctx";

export type { Scope } from "./ctx";

export function scopeOf(user: Pick<SessionUser, "role" | "branchId">): Scope {
  if (isMainAdmin(user.role)) return { kind: "all" };
  if (user.branchId === null) throw new Error("branch user without a branch");
  return { kind: "branch", branchId: user.branchId };
}

function needRole(
  ctx: Pick<RequestCtx, "session">,
  allowed: (role: StaffRole) => boolean,
): Result<SessionInfo> {
  const { session } = ctx;
  if (!session) return err("UNAUTHENTICATED", "Your session has ended. Sign in again.");
  if (!allowed(session.user.role)) return err("FORBIDDEN", "You can't do that.");
  return ok(session);
}

export function requireStaff(ctx: Pick<RequestCtx, "session">): Result<SessionInfo> {
  return needRole(ctx, () => true);
}

export function requireAdmin(ctx: Pick<RequestCtx, "session">): Result<SessionInfo> {
  return needRole(ctx, isAdmin);
}

export function requireMainAdmin(ctx: Pick<RequestCtx, "session">): Result<SessionInfo> {
  return needRole(ctx, isMainAdmin);
}

/** `wanted` narrows only an all-branches scope; a branch scope always uses its own branch. */
export function branchFilter(col: AnyColumn, scope: Scope, wanted?: string): SQL | undefined {
  if (scope.kind === "branch") return eq(col, scope.branchId);
  return wanted ? eq(col, wanted) : undefined;
}

export function inScope(scope: Scope, branchId: string | null): boolean {
  return scope.kind === "all" || (branchId !== null && branchId === scope.branchId);
}
