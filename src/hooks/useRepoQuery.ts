"use client";

import { useQuery } from "@tanstack/react-query";
import { useDataAccess } from "@/data/access/provider";
import type { DataAccess, RepoError, Result, Topic } from "@/data/access";

export type RepoQueryKey = readonly [Topic | "analytics", ...unknown[]];

export interface RepoQueryState<T> {
  data?: T;
  error?: RepoError;
  isLoading: boolean;
}

/** Wraps `useQuery` over a repo call. Error results are surfaced as `error`, never thrown. */
export function useRepoQuery<T>(
  key: RepoQueryKey,
  fn: (da: DataAccess) => Promise<Result<T>>,
): RepoQueryState<T> {
  const da = useDataAccess();
  const query = useQuery({ queryKey: [...key], queryFn: () => fn(da) });
  const result = query.data;
  if (result === undefined) return { isLoading: query.isPending };
  if (result.ok) return { data: result.value, isLoading: false };
  return { error: result.error, isLoading: false };
}
