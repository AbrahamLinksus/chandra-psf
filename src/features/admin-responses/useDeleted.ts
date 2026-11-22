"use client";

import { useState } from "react";
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
        ? Promise.resolve(err("SAVE_FAILED", "Pick a response to restore"))
        : mutation.run({ id: restoring, password }),
  };
}
