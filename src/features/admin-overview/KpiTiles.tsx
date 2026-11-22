import { ArrowDownIcon, ArrowUpIcon, MinusIcon } from "lucide-react";
import { MetricValue } from "@/components/shared/MetricValue";
import type { MetricFormat } from "@/components/shared/formatMetric";
import type { Metric, OverviewData } from "@/domain/types";

/** Change vs the previous period; nothing at all when there is no delta (S-10). */
export function DeltaArrow({ delta, format }: { delta: number | null; format: MetricFormat }) {
  if (delta === null) return null;
  const abs = Math.abs(delta);
  const text =
    format === "percent"
      ? `${String(Math.round(abs))} pts`
      : format === "count"
        ? String(Math.round(abs))
        : abs.toFixed(1);
  if (delta === 0) {
    return (
      <span className="flex items-center gap-1 text-sm text-muted-foreground">
        <MinusIcon className="size-4" aria-hidden /> no change
      </span>
    );
  }
  const up = delta > 0;
  const Icon = up ? ArrowUpIcon : ArrowDownIcon;
  return (
    <span
      data-testid="delta"
      data-direction={up ? "up" : "down"}
      className={`flex items-center gap-1 text-sm font-medium ${up ? "text-success" : "text-danger"}`}
    >
      <Icon className="size-4" aria-hidden />
      <span className="sr-only">{up ? "Up" : "Down"} </span>
      {text} vs previous period
    </span>
  );
}

function Tile(props: {
  label: string;
  value: number | null;
  format: MetricFormat;
  delta?: number | null;
}) {
  return (
    <div className="grid gap-1 rounded-2xl border bg-card p-4 shadow-sm" data-testid="kpi-tile">
      <p className="text-sm text-muted-foreground">{props.label}</p>
      <p className="text-3xl font-semibold">
        <MetricValue value={props.value} format={props.format} />
      </p>
      {props.delta !== undefined && <DeltaArrow delta={props.delta} format={props.format} />}
    </div>
  );
}

function fromMetric(label: string, m: Metric, format: MetricFormat) {
  return <Tile label={label} value={m.value} format={format} delta={m.delta} />;
}

export function KpiTiles({ kpis }: { kpis: OverviewData["kpis"] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {fromMetric("Responses received", kpis.responses, "count")}
      {fromMetric("Response rate", kpis.responseRate, "percent")}
      {fromMetric("Avg overall satisfaction (Q12)", kpis.avgQ12, "score")}
      {fromMetric("Recommend rate", kpis.recommendRate, "percent")}
      <Tile label="Open alerts" value={kpis.openAlerts} format="count" />
    </div>
  );
}
