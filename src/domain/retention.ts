import {
  DELETED_PURGE_DAYS,
  RETENTION_ANSWERED_YEARS,
  RETENTION_UNANSWERED_DAYS,
} from "./constants";
import { addDays, istDateOf } from "./time";
import type { ISODate, ISOTime } from "./types";

const MS_PER_DAY = 86_400_000;

function addYears(d: ISODate, years: number): ISODate {
  const [y, m, day] = d.split("-").map(Number) as [number, number, number];
  const target = new Date(Date.UTC(y + years, m - 1, day));
  if (target.getUTCMonth() !== m - 1) target.setUTCDate(0); // 29 Feb lands on 28 Feb
  return target.toISOString().slice(0, 10);
}

/** IST date on which a job card's personal data is erased (SPEC F-10): +90 days, or +3 years if answered. */
export function retentionDueDate(serviceDate: ISODate, answered: boolean): ISODate {
  return answered
    ? addYears(serviceDate, RETENTION_ANSWERED_YEARS)
    : addDays(serviceDate, RETENTION_UNANSWERED_DAYS);
}

export interface RetentionCutoffs {
  /** Unanswered job cards with `serviceDate <= unansweredOn` are due in this run. */
  unansweredOn: ISODate;
  /** Answered job cards with `serviceDate <= answeredOn` are due in this run. */
  answeredOn: ISODate;
  /** Deleted responses with `deletedAt < deletedBefore` are purged. */
  deletedBefore: ISOTime;
}

/** Cut-offs for the daily clean-up run at `now` (IST dates). */
export function retentionCutoffs(now: Date): RetentionCutoffs {
  const today = istDateOf(now);
  return {
    unansweredOn: addDays(today, -RETENTION_UNANSWERED_DAYS),
    answeredOn: addYears(today, -RETENTION_ANSWERED_YEARS),
    deletedBefore: new Date(now.getTime() - DELETED_PURGE_DAYS * MS_PER_DAY).toISOString(),
  };
}
