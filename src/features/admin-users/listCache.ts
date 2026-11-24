import type { QueryClient } from "@tanstack/react-query";
import { ok, type Result } from "@/data/access/result";
import type { User } from "@/domain/types";

export const USERS_LIST_KEY = ["users", "list"] as const;

/** Replaces the saved user in the cached list, or appends it when new. Leaves a failed or empty cache alone. */
export function mergeUser(queryClient: QueryClient, saved: User): void {
  queryClient.setQueryData<Result<User[]>>(USERS_LIST_KEY, (old) => {
    if (old === undefined || !old.ok) return old;
    const known = old.value.some((u) => u.id === saved.id);
    return ok(
      known ? old.value.map((u) => (u.id === saved.id ? saved : u)) : [...old.value, saved],
    );
  });
}
