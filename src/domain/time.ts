import type { ISODate, ISOTime } from "./types";

const IST = "Asia/Kolkata";
const IST_OFFSET_MINUTES = 330;
const MS_PER_MINUTE = 60_000;
const MINUTES_PER_DAY = 1440;

const dateParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: IST,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** IST calendar day (YYYY-MM-DD) of an instant. */
export function istDateOf(t: ISOTime | Date): ISODate {
  const d = typeof t === "string" ? new Date(t) : t;
  return dateParts.format(d);
}

function utcMidnight(d: ISODate): Date {
  return new Date(`${d}T00:00:00.000Z`);
}

export function addDays(d: ISODate, n: number): ISODate {
  const date = utcMidnight(d);
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}

/** Whole days from `a` to `b` (b - a). */
export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round(
    (utcMidnight(b).getTime() - utcMidnight(a).getTime()) / (MINUTES_PER_DAY * MS_PER_MINUTE),
  );
}

/** UTC instant for `minute` minutes after midnight IST on `date`. */
export function istToISOTime(date: ISODate, minute: number): ISOTime {
  const ms = utcMidnight(date).getTime() + (minute - IST_OFFSET_MINUTES) * MS_PER_MINUTE;
  return new Date(ms).toISOString();
}

/** "14 Nov" (or "14 Nov 2026" with `year`). Display only. */
export function formatISTDate(d: ISODate, opts: { year?: boolean } = {}): string {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    ...(opts.year === true ? { year: "numeric" as const } : {}),
  });
  return fmt.format(utcMidnight(d));
}

/** "14 Nov 2026, 3:30 pm" in IST. */
export function formatIST(t: ISOTime): string {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return fmt.format(new Date(t));
}
