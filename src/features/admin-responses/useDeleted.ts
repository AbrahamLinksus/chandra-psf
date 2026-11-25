"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { err } from "@/data/access";
import { useRepoMutation } from "@/hooks/useRepoMutation";
import { useRepoQuery } from "@/hooks/useRepoQuery";

/** Recently deleted responses plus the restore flow (password prompt for one row). */
export function useDeleted() {
  const query = useRepoQuery(["responses", "deleted"], (da) => da.responses.listDeleted());
  const [restoring, setRestoring] = useState<string | null>(null);
  const mutation = useRepoMutation((da, i: { id: string; password: string }) =>
    da.responses.restoreResponse(i.id, { password: i.password }),
  );
  const queryClient = useQueryClient();
  const restore = async (id: string, password: string) => {
    const result = await mutation.run({ id, password });
    if (result.ok) void queryClient.invalidateQueries({ queryKey: ["responses"] });
    return result;
  };
  return {
    rows: query.data,
    error: query.error,
    isLoading: query.isLoading,
    restoring,
    ask: setRestoring,
    close: () => {
      setRestoring(null);
      mutation.reset();
    },
    restore: (password: string) =>
      restoring === null
        ? Promise.resolve(err("SAVE_FAILED", "Couldn't restore"))
        : restore(restoring, password),
  };
}
