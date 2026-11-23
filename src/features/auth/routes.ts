import { isAdmin } from "@/domain/roles";
import type { User } from "@/domain/types";
import { safeNext } from "@/lib/signInUrl";

export { safeNext, signInUrl } from "@/lib/signInUrl";

/** Where a freshly signed-in user lands (F-1). */
export function landingPath(user: User): string {
  if (user.mustSetPassword) return "/set-password";
  return isAdmin(user.role) ? "/admin" : "/support";
}

function allowedFor(user: User, path: string): boolean {
  const area = path.split(/[/?#]/)[1];
  if (area === "admin") return isAdmin(user.role);
  if (area === "support") return !isAdmin(user.role);
  return area === "account";
}

/** After sign-in: back to `next` when it is a safe page this user may open, else their landing page. */
export function postSignInPath(user: User, next: string | null): string {
  if (user.mustSetPassword) return "/set-password";
  const safe = safeNext(next);
  return safe !== null && allowedFor(user, safe) ? safe : landingPath(user);
}
