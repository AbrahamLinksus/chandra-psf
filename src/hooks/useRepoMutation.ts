"use client";

import { useCallback, useState } from "react";
import { useDataAccess } from "@/data/access/provider";
import { err, type DataAccess, type RepoError, type Result } from "@/data/access";

export type MutationStatus = "idle" | "saving" | "error" | "done";

export interface RepoMutation<I, T> {
  run(input: I): Promise<Result<T>>;
  status: MutationStatus;
  error?: RepoError;
  reset(): void;
}

interface State {
  status: MutationStatus;
  error?: RepoError;
}

/** Drives every saving state and the "Couldn't save, try again" message (S-13). */
export function useRepoMutation<I, T>(
  fn: (da: DataAccess, input: I) => Promise<Result<T>>,
): RepoMutation<I, T> {
  const da = useDataAccess();
  const [state, setState] = useState<State>({ status: "idle" });

  const run = useCallback(
    async (input: I): Promise<Result<T>> => {
      setState({ status: "saving" });
      let result: Result<T>;
      try {
        result = await fn(da, input);
      } catch {
        result = err("SAVE_FAILED", "Couldn't save, try again");
      }
      setState(result.ok ? { status: "done" } : { status: "error", error: result.error });
      return result;
    },
    [da, fn],
  );

  const reset = useCallback(() => {
    setState({ status: "idle" });
  }, []);
  return state.error === undefined
    ? { run, status: state.status, reset }
    : { run, status: state.status, error: state.error, reset };
}
