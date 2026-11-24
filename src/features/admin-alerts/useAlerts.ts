"use client";

import { useMemo, useState } from "react";
import type { AlertView } from "@/data/access/repos/alerts";
import type { AlertStatus } from "@/domain/types";
import { useRepoQuery } from "@/hooks/useRepoQuery";
import { useSession } from "@/hooks/useSession";

export type AlertFilter = AlertStatus | "all";

/** Alerts in the caller's scope (newest first); main admin can narrow by branch. Status filter is client-side. */
export function useAlerts() {
  const [filter, setFilter] = useState<AlertFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [branchId, setBranchId] = useState("all");
  const { user } = useSession();
  const isMain = user?.role === "main_admin";
  const branches = useRepoQuery(["branches", isMain ? "list" : "none"], (da) =>
    isMain ? da.branches.listBranches() : Promise.resolve({ ok: true as const, value: [] }),
  );
  const scoped = isMain && branchId !== "all" ? branchId : undefined;
  const query = useRepoQuery(["alerts", "list", scoped ?? "all"], (da) =>
    da.alerts.listAlerts(scoped === undefined ? {} : { branchId: scoped }),
  );
  const all = query.data;
  const rows = useMemo<AlertView[] | undefined>(
    () => (filter === "all" ? all : all?.filter((a) => a.status === filter)),
    [all, filter],
  );
  const selected = all?.find((a) => a.id === selectedId);
  return {
    filter,
    setFilter,
    isMain,
    branchId,
    setBranchId,
    branchOptions: branches.data?.map((b) => ({ value: b.id, label: b.name })) ?? [],
    rows,
    total: all?.length,
    selected,
    select: setSelectedId,
    error: query.error,
    isLoading: query.isLoading,
  };
}
