"use client";

import { useRef, useState } from "react";
import type { BranchWithCount } from "@/data/access/repos/branches";
import { useRefreshingMutation } from "./useRefreshingMutation";
import { useRepoQuery } from "@/hooks/useRepoQuery";

/** Deactivate (confirmed) / reactivate; deactivating ends the branch staff's sessions. */
function useBranchToggle() {
  const [pending, setPending] = useState<BranchWithCount | null>(null);
  const toggle = useRefreshingMutation((da, i: { id: string; active: boolean }) =>
    da.branches.setBranchActive(i.id, i.active),
  );
  const last = useRef<{ b: BranchWithCount; active: boolean } | null>(null);
  const apply = async (b: BranchWithCount, active: boolean) => {
    last.current = { b, active };
    const r = await toggle.run({ id: b.id, active });
    if (r.ok) setPending(null);
  };
  return {
    pending,
    toggle,
    request: (b: BranchWithCount, active: boolean) => {
      toggle.reset();
      if (active) void apply(b, true);
      else setPending(b);
    },
    retry: () => {
      if (last.current !== null) void apply(last.current.b, last.current.active);
    },
    confirm: () => {
      if (pending !== null) void apply(pending, false);
    },
    close: () => {
      toggle.reset();
      setPending(null);
    },
  };
}

/** Branch list with rename and deactivate / reactivate. Branches are never deleted. */
export function useBranchList() {
  const query = useRepoQuery(["branches", "list"], (da) => da.branches.listBranches());
  const t = useBranchToggle();
  const update = useRefreshingMutation((da, i: { id: string; name: string; city: string }) =>
    da.branches.updateBranch(i.id, { name: i.name, city: i.city }),
  );
  const rename = async (id: string, v: { name: string; city: string }) => {
    const r = await update.run({ id, ...v });
    return r.ok ? null : r.error;
  };
  return {
    branches: query.data,
    error: query.error,
    isLoading: query.isLoading,
    ...t,
    busy: update.status === "saving" || t.toggle.status === "saving",
    rename,
  };
}
