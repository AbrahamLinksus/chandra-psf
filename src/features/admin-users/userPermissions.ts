import type { User } from "@/domain/types";

/** UI mirror of the server's G-9 rules; the server stays the authority. */
export function canEdit(me: User, target: User): boolean {
  if (me.role === "main_admin") return true;
  return me.role === "branch_admin" && target.role === "support" && target.id !== me.id;
}

/** Role and branch are changed only by a main admin, never on themself. */
export const canMove = (me: User, target: User): boolean =>
  me.role === "main_admin" && me.id !== target.id;

/** Deactivate, reactivate and reset password: never on self; branch admins only for support. */
export function canManage(me: User, target: User): boolean {
  if (me.id === target.id) return false;
  return me.role === "main_admin" || (me.role === "branch_admin" && target.role === "support");
}
