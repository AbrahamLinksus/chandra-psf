"use client";

import type { FilterOptions } from "@/data/access";
import type { Filters, OverviewData } from "@/domain/types";
import { useFiltersFromUrl } from "@/hooks/useFiltersFromUrl";
import { useRepoQuery } from "@/hooks/useRepoQuery";

export interface OverviewState {
  filters: Filters;
  setFilters: (next: Filters) => void;
  data?: OverviewData;
  options?: FilterOptions;
  errorCode?: string;
  errorMessage?: string;
  isLoading: boolean;
}

/** Filters (kept in the URL) plus the analytics and filter options they drive. */
export function useOverview(): OverviewState {
  const url = useFiltersFromUrl();
  const filters = url.filters;
  const analytics = useRepoQuery(["analytics", filters], (da) =>
    da.analytics.getAnalytics(filters),
  );
  const options = useRepoQuery(["analytics", "options"], (da) => da.analytics.getFilterOptions());
  const error = analytics.error ?? options.error;
  return {
    filters,
    setFilters: (next) => {
      url.setFilters(next);
    },
    isLoading: analytics.isLoading || options.isLoading,
    ...(analytics.data ? { data: analytics.data } : {}),
    ...(options.data ? { options: options.data } : {}),
    ...(error ? { errorCode: error.code, errorMessage: error.message } : {}),
  };
}
