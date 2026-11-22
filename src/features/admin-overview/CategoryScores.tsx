import { MetricValue } from "@/components/shared/MetricValue";
import { Progress } from "@/components/ui/progress";
import type { OverviewData } from "@/domain/types";
import { BlockCard } from "./BlockCard";

export function CategoryScores({ scores }: { scores: OverviewData["categoryScores"] }) {
  return (
    <BlockCard title="Category scores">
      <ul className="grid gap-3">
        {scores.map((s) => (
          <li key={s.step} className="grid gap-1">
            <div className="flex justify-between gap-2 text-sm">
              <span>{s.title}</span>
              <span className="font-medium">
                <MetricValue value={s.score} format="count" />
                {s.score !== null && <span className="text-muted-foreground"> / 100</span>}
              </span>
            </div>
            <Progress value={s.score ?? 0} className="h-3" aria-label={`${s.title} score`} />
          </li>
        ))}
      </ul>
    </BlockCard>
  );
}
