import { addDays, daysBetween } from "../time";
import type { AnswerMap, Filters, ISODate, OverviewData } from "../types";
import { avgRating, yesPercent } from "./stats";

const WEEKLY_MAX_DAYS = 90;
const DAYS_PER_WEEK = 7;

type Trend = OverviewData["trend"];
export interface DatedAnswers {
  serviceDate: ISODate;
  answers: AnswerMap;
}

function weekStart(d: ISODate): ISODate {
  const weekday = new Date(`${d}T00:00:00.000Z`).getUTCDay();
  return addDays(d, -((weekday + 6) % DAYS_PER_WEEK));
}

function bucketOf(d: ISODate, granularity: Trend["granularity"]): ISODate {
  return granularity === "week" ? weekStart(d) : `${d.slice(0, 7)}-01`;
}

function nextBucket(b: ISODate, granularity: Trend["granularity"]): ISODate {
  if (granularity === "week") return addDays(b, DAYS_PER_WEEK);
  const next = new Date(`${b}T00:00:00.000Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  return next.toISOString().slice(0, 10);
}

/** Weekly up to 90 days, monthly beyond; every bucket of the range is present, empty ones are null. */
export function buildTrend(rows: DatedAnswers[], f: Filters): Trend {
  if (rows.length === 0) return { granularity: "week", points: [] };
  const granularity = daysBetween(f.from, f.to) + 1 <= WEEKLY_MAX_DAYS ? "week" : "month";
  const groups = new Map<ISODate, AnswerMap[]>();
  for (const r of rows) {
    const key = bucketOf(r.serviceDate, granularity);
    groups.set(key, [...(groups.get(key) ?? []), r.answers]);
  }
  const points: Trend["points"] = [];
  const last = bucketOf(f.to, granularity);
  for (let b = bucketOf(f.from, granularity); b <= last; b = nextBucket(b, granularity)) {
    const list = groups.get(b) ?? [];
    points.push({
      bucketStart: b,
      avgQ12: avgRating(list, "Q12"),
      recommendRate: yesPercent(list, "Q13"),
    });
  }
  return { granularity, points };
}
