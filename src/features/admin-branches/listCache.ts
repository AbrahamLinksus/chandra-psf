import type { QueryClient } from "@tanstack/react-query";
import { ok, type Result } from "@/data/access/result";
import type { BranchWithCount } from "@/data/access/repos/branches";
import type { Branch } from "@/domain/types";

export const BRANCHES_LIST_KEY = ["branches", "list"] as const;

/** Replaces the saved branch in the cached list (keeping its staff count), or appends it when new. */
export function mergeBranch(queryClient: QueryClient, saved: Branch): void {
  queryClient.setQueryData<Result<BranchWithCount[]>>(BRANCHES_LIST_KEY, (old) => {
    if (old === undefined || !old.ok) return old;
    const known = old.value.find((b) => b.id === saved.id);
    if (known === undefined) return ok([...old.value, { ...saved, staffCount: 0 }]);
    return ok(
      old.value.map((b) => (b.id === saved.id ? { ...saved, staffCount: known.staffCount } : b)),
    );
  });
}
