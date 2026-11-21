import { formatMetric, type MetricFormat } from "./formatMetric";

export function MetricValue({ value, format }: { value: number | null; format: MetricFormat }) {
  return <span className="tabular-nums">{formatMetric(value, format)}</span>;
}
