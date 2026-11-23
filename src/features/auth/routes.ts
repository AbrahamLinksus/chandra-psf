import { isAdmin } from "@/domain/roles";
import type { User } from "@/domain/types";

/** Where a freshly signed-in user lands (F-1). */
export function landingPath(user: User): string {
  if (user.mustSetPassword) return "/set-password";
  return isAdmin(user.role) ? "/admin" : "/support";
}
