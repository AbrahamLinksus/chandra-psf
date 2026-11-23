"use client";

import { useQueryClient } from "@tanstack/react-query";
import type { DataAccess, Result } from "@/data/access";
import { useRepoMutation, type RepoMutation } from "@/hooks/useRepoMutation";

/** A repo mutation that refetches the branch and advisor lists right after it succeeds. */
export function useRefreshingMutation<I, T>(
  fn: (da: DataAccess, input: I) => Promise<Result<T>>,
): RepoMutation<I, T> {
  const queryClient = useQueryClient();
  const mutation = useRepoMutation(fn);
  const run = async (input: I): Promise<Result<T>> => {
    const result = await mutation.run(input);
    if (result.ok) {
      void queryClient.invalidateQueries({ queryKey: ["branches"] });
      void queryClient.invalidateQueries({ queryKey: ["advisors"] });
    }
    return result;
  };
  return { ...mutation, run };
}
