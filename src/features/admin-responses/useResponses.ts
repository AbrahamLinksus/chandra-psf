"use client";

import type { FilterOptions } from "@/data/access";
import type { ResponseListRow } from "@/data/access/repos/responses";
import type { Filters } from "@/domain/types";
import { useFiltersFromUrl } from "@/hooks/useFiltersFromUrl";
import { useRepoQuery } from "@/hooks/useRepoQuery";

export interface ResponsesState {
  filters: Filters;
  setFilters: (next: Filters) => void;
  rows?: ResponseListRow[];
  options?: FilterOptions;
  errorMessage?: string;
  isLoading: boolean;
}

/** Filters (kept in the URL) plus the live response list and the filter options. */
export function useResponses(): ResponsesState {
  const url = useFiltersFromUrl();
  const filters = url.filters;
  const list = useRepoQuery(["responses", "list", filters], (da) =>
    da.responses.listResponses(filters),
  );
  const options = useRepoQuery(["analytics", "options"], (da) => da.analytics.getFilterOptions());
  const error = list.error ?? options.error;
  return {
    filters,
    setFilters: (next) => {
      url.setFilters(next);
    },
    isLoading: list.isLoading || options.isLoading,
    ...(list.data ? { rows: list.data } : {}),
    ...(options.data ? { options: options.data } : {}),
    ...(error ? { errorMessage: error.message } : {}),
  };
}
