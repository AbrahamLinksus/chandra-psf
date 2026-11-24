import "server-only";
import { err, ok, type Result } from "@/data/access/result";
import { MIN_PASSWORD_LENGTH } from "@/domain/constants";
import { passwordProblem } from "@/domain/passwordPolicy";
import { isMainAdmin } from "@/domain/roles";
import type { Role, User } from "@/domain/types";
import type { SessionUser } from "../ctx";
import type { users } from "../db/schema";

export const OTP_TTL_MS = 72 * 3_600_000;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const EMAIL_IN_USE = "Email already in use";
export const NOT_FOUND = "Not found";
export const FORBIDDEN = "You can't do that.";
export const LAST_ADMIN = "There must be at least one active main admin.";

export type Row = typeof users.$inferSelect;
export type Target = { row: Row; branchName: string | null };
export type Change = "profile" | "role" | "branch" | "active" | "reset";
export type Patch = { name?: string; email?: string; role?: Role; branchId?: string | null };
export type Fields = { name: string; email: string; role: Role; branchId: string | null };
export type Actor = SessionUser;

export function toUser(row: Row, branchName: string | null): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    active: row.active,
    mustSetPassword: row.mustSetPassword,
    branchId: row.branchId,
    branchName,
    lastSignInAt: row.lastSignInAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export const snapshot = (r: Row): Fields => ({
  name: r.name,
  email: r.email,
  role: r.role,
  branchId: r.branchId,
});

/** Only the fields that differ, so the audit row reads old → new. */
export function diff(
  before: Fields,
  after: Fields,
): { oldValue: Partial<Fields>; newValue: Partial<Fields> } {
  const oldValue: Record<string, unknown> = {};
  const newValue: Record<string, unknown> = {};
  for (const k of Object.keys(before) as (keyof Fields)[]) {
    if (before[k] === after[k]) continue;
    oldValue[k] = before[k];
    newValue[k] = after[k];
  }
  return { oldValue, newValue };
}

/** Who may change what (LLD §23, G-9). Branch admins see only their branch: elsewhere it is "Not found". */
export function assertCanManage(actor: Actor, target: Row, changes: Change[]): Result<void> {
  const self = actor.id === target.id;
  if (!isMainAdmin(actor.role)) {
    if (target.branchId !== actor.branchId) return err("NOT_FOUND", NOT_FOUND);
    const allowed = changes.every((c) => c !== "role" && c !== "branch");
    if (self || target.role !== "support" || !allowed) return err("FORBIDDEN", FORBIDDEN);
    return ok(undefined);
  }
  const touchesOwn = changes.some((c) => c !== "profile");
  if (self && touchesOwn) return err("FORBIDDEN", FORBIDDEN);
  return ok(undefined);
}

export function cleanPatch(p: Patch): Result<Patch> {
  const out: Patch = { ...p };
  if (p.name !== undefined) {
    out.name = p.name.trim();
    if (!out.name) return err("VALIDATION", "Enter a name", ["name"]);
  }
  if (p.email !== undefined) {
    out.email = p.email.trim().toLowerCase();
    if (!EMAIL_SHAPE.test(out.email))
      return err("VALIDATION", "Enter a valid email address", ["email"]);
  }
  return ok(out);
}

export function tempPasswordError(pw: string): Result<never> | null {
  const problem = passwordProblem(pw);
  if (problem === "too_short")
    return err("VALIDATION", `Use at least ${String(MIN_PASSWORD_LENGTH)} characters`, [
      "tempPassword",
    ]);
  if (problem === "too_common")
    return err("VALIDATION", "That password is too common. Choose another.", ["tempPassword"]);
  return null;
}

/** A branch admin adds only support users, into their own branch; a main admin chooses. */
export function wantedBranch(
  actor: SessionUser,
  input: { role: Role; branchId: string | null },
): Result<string | null> {
  if (isMainAdmin(actor.role)) return ok(input.branchId);
  return input.role === "support" ? ok(actor.branchId) : err("FORBIDDEN", FORBIDDEN);
}
