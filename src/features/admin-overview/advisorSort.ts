import type { OverviewData } from "@/domain/types";

export type AdvisorRow = OverviewData["advisors"][number];
export type AdvisorSortKey =
  | "name"
  | "branchName"
  | "responses"
  | "score"
  | "avgBehaviour"
  | "onTimePercent"
  | "avgSatisfaction";
export type SortDir = "asc" | "desc";

/** Sorted copy; empty values (null) always go last. */
export function sortAdvisors(rows: AdvisorRow[], key: AdvisorSortKey, dir: SortDir): AdvisorRow[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = a[key];
    const y = b[key];
    if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
    if (typeof x === "string" && typeof y === "string") return sign * x.localeCompare(y);
    return sign * (Number(x) - Number(y));
  });
}
