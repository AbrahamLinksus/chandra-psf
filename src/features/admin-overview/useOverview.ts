"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { FilterOptions } from "@/data/access";
import type { AnalyticsFilters } from "@/data/access/repos/analytics";
import type { Filters, OverviewData } from "@/domain/types";
import { useFiltersFromUrl } from "@/hooks/useFiltersFromUrl";
import { useRepoQuery } from "@/hooks/useRepoQuery";

export interface OverviewState {
  filters: Filters;
  branchId?: string;
  setFilters: (next: Filters) => void;
  setBranchId: (branchId: string | undefined) => void;
  data?: OverviewData;
  options?: FilterOptions;
  errorCode?: string;
  errorMessage?: string;
  isLoading: boolean;
}

/** Filters (kept in the URL) plus the analytics and filter options they drive. */
export function useOverview(): OverviewState {
  const url = useFiltersFromUrl();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const filters = url.filters;
  const branchId = params.get("branchId") || undefined;
  const query: AnalyticsFilters = { ...filters, ...(branchId ? { branchId } : {}) };

  const replace = (f: Filters, branch: string | undefined) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(f)) if (typeof v === "string" && v !== "") p.set(k, v);
    if (branch) p.set("branchId", branch);
    router.replace(`${pathname}?${p.toString()}`);
  };

  const analytics = useRepoQuery(["analytics", query], (da) => da.analytics.getAnalytics(query));
  const options = useRepoQuery(["analytics", "options", branchId ?? ""], (da) =>
    da.analytics.getFilterOptions(branchId ? { branchId } : undefined),
  );
  const error = analytics.error ?? options.error;
  return {
    filters,
    ...(branchId ? { branchId } : {}),
    setFilters: (next) => {
      replace(next, branchId);
    },
    setBranchId: (next) => {
      // The advisor list follows the branch, so a stale advisor is dropped.
      const rest: Filters = { ...filters };
      delete rest.advisorId;
      replace(rest, next);
    },
    isLoading: analytics.isLoading || options.isLoading,
    ...(analytics.data ? { data: analytics.data } : {}),
    ...(options.data ? { options: options.data } : {}),
    ...(error ? { errorCode: error.code, errorMessage: error.message } : {}),
  };
}
