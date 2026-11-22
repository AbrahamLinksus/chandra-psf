"use client";

import { useMemo, useState } from "react";
import type { AlertView } from "@/data/access/repos/alerts";
import type { AlertStatus } from "@/domain/types";
import { useRepoQuery } from "@/hooks/useRepoQuery";

export type AlertFilter = AlertStatus | "all";

/** All live alerts (newest first) with a client-side status filter and the selected row. */
export function useAlerts() {
  const [filter, setFilter] = useState<AlertFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const query = useRepoQuery(["alerts", "list"], (da) => da.alerts.listAlerts());
  const all = query.data;
  const rows = useMemo<AlertView[] | undefined>(
    () => (filter === "all" ? all : all?.filter((a) => a.status === filter)),
    [all, filter],
  );
  const selected = all?.find((a) => a.id === selectedId);
  return {
    filter,
    setFilter,
    rows,
    total: all?.length,
    selected,
    select: setSelectedId,
    error: query.error,
    isLoading: query.isLoading,
  };
}
