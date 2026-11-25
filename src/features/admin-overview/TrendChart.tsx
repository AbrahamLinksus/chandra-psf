"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { OverviewData } from "@/domain/types";
import { BlockCard, NoData } from "./BlockCard";

const CONFIG: ChartConfig = {
  avgSatisfaction: { label: "Avg overall satisfaction (out of 5)", color: "var(--chart-1)" },
  recommendRate: { label: "Recommend rate (%)", color: "var(--chart-2)" },
};

export function TrendChart({ trend }: { trend: OverviewData["trend"] }) {
  const hasData = trend.points.some((p) => p.avgSatisfaction !== null || p.recommendRate !== null);
  return (
    <BlockCard title={`Trend (per ${trend.granularity})`} className="lg:col-span-2">
      {hasData ? (
        <ChartContainer config={CONFIG} className="h-56 w-full">
          <LineChart data={trend.points}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="bucketStart" tickMargin={8} />
            <YAxis yAxisId="sat" domain={[1, 5]} width={28} />
            <YAxis yAxisId="rate" orientation="right" domain={[0, 100]} width={36} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              yAxisId="sat"
              dataKey="avgSatisfaction"
              stroke="var(--color-avgSatisfaction)"
              connectNulls
            />
            <Line
              yAxisId="rate"
              dataKey="recommendRate"
              stroke="var(--color-recommendRate)"
              connectNulls
            />
          </LineChart>
        </ChartContainer>
      ) : (
        <NoData />
      )}
    </BlockCard>
  );
}
