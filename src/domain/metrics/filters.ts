import { DEFAULT_RANGE_DAYS } from "../constants";
import { addDays, daysBetween, istDateOf } from "../time";
import type { Filters, JobCard } from "../types";

/** Last DEFAULT_RANGE_DAYS days up to today (IST); same range as `useFiltersFromUrl`. */
export function defaultFilters(now: Date): Filters {
  const to = istDateOf(now);
  return { from: addDays(to, -DEFAULT_RANGE_DAYS), to };
}

/** The same-length period immediately before `from`; other filters are kept. */
export function previousPeriod(f: Filters): Filters {
  const length = daysBetween(f.from, f.to) + 1;
  const to = addDays(f.from, -1);
  return { ...f, from: addDays(to, -(length - 1)), to };
}

/** A job card is in scope when its service date is in range and every set filter matches (S-11). */
export function matches(jobCard: JobCard, f: Filters): boolean {
  if (jobCard.serviceDate < f.from || jobCard.serviceDate > f.to) return false;
  if (f.vehicleType !== undefined && jobCard.vehicleType !== f.vehicleType) return false;
  if (f.model !== undefined && jobCard.model !== f.model) return false;
  return f.advisorId === undefined || jobCard.advisorId === f.advisorId;
}
