"use client";

import { ok } from "@/data/access";
import { useRepoQuery } from "@/hooks/useRepoQuery";

export interface BranchOption {
  id: string;
  name: string;
}

/**
 * Active branches for the branch picker (main admin only; others get an empty list).
 * The disabled case uses its own key so its empty list never lands in the shared branch list cache.
 */
export function useBranchOptions(enabled: boolean) {
  const query = useRepoQuery(enabled ? ["branches", "list"] : ["branches", "none"], (da) =>
    enabled ? da.branches.listBranches() : Promise.resolve(ok([])),
  );
  const options: BranchOption[] = (query.data ?? [])
    .filter((b) => b.active)
    .map((b) => ({ id: b.id, name: b.name }));
  return { options, isLoading: query.isLoading };
}
