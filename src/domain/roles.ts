/** Phase-2 staff roles (LLD-phase2 §17.2). */
export type StaffRole = "support" | "branch_admin" | "main_admin";

export function isAdmin(role: StaffRole): boolean {
  return role === "branch_admin" || role === "main_admin";
}

export function isMainAdmin(role: StaffRole): boolean {
  return role === "main_admin";
}
