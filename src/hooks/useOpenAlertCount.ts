"use client";

import { useRepoQuery } from "./useRepoQuery";

/** Open alerts for the admin nav badge; 0 while loading or unavailable. */
export function useOpenAlertCount(): number {
  const { data } = useRepoQuery(["alerts", "openCount"], (da) => da.alerts.countOpen());
  return data ?? 0;
}
