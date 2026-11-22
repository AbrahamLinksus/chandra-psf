import { SearchXIcon } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import type { OverviewData } from "@/domain/types";
import { AdvisorTable } from "./AdvisorTable";
import { CategoryScores } from "./CategoryScores";
import { ProblemBreakdown } from "./ProblemBreakdown";
import { QuestionDetail } from "./QuestionDetail";
import { RecentComments } from "./RecentComments";
import { TrendChart } from "./TrendChart";

/** "No responses for these filters": nothing to chart, so no blocks (S-10). */
export function isEmptyOverview(data: OverviewData): boolean {
  return data.kpis.responses.value === null;
}

export function OverviewBlocks({ data }: { data: OverviewData }) {
  if (isEmptyOverview(data)) {
    return (
      <div className="rounded-2xl border bg-card shadow-sm">
        <EmptyState
          icon={SearchXIcon}
          title="No responses for these filters"
          hint="Try a wider date range or clear a filter."
        />
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
      <CategoryScores scores={data.categoryScores} />
      <TrendChart trend={data.trend} />
      <AdvisorTable advisors={data.advisors} />
      <ProblemBreakdown problems={data.problems} />
      <QuestionDetail detail={data.questionDetail} />
      <RecentComments comments={data.comments} />
    </div>
  );
}
