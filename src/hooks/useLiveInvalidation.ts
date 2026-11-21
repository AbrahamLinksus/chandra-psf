"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDataAccess } from "@/data/access/provider";

/** Any change signalled by the data layer (this tab or another) refreshes every query. */
export function useLiveInvalidation(): void {
  const da = useDataAccess();
  const queryClient = useQueryClient();
  useEffect(
    () =>
      da.subscribe(() => {
        void queryClient.invalidateQueries();
      }),
    [da, queryClient],
  );
}
