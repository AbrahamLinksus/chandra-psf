export type MetricFormat = "percent" | "score" | "count";

const EMPTY = "—";

/** Display text of a metric; null (no data) is a dash, never 0 (S-10). */
export function formatMetric(value: number | null, format: MetricFormat): string {
  if (value === null) return EMPTY;
  if (format === "percent") return `${String(Math.round(value))}%`;
  if (format === "score") return value.toFixed(1);
  return String(Math.round(value));
}
