import type { OverviewData } from "@/domain/types";
import { formatISTDate } from "@/domain/time";
import { BlockCard, NoData } from "./BlockCard";

export function RecentComments({ comments }: { comments: OverviewData["comments"] }) {
  return (
    <BlockCard title="Recent comments">
      {comments.length === 0 ? (
        <NoData />
      ) : (
        <ul className="grid gap-3">
          {comments.map((c) => (
            <li
              key={`${c.responseId}-${c.source}`}
              className="rounded-xl border p-3"
              data-testid="comment"
            >
              <div className="flex justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {formatISTDate(c.serviceDate, { year: true })} · {c.source}
                </span>
                <span className="font-medium text-foreground">Q12: {c.q12}/5</span>
              </div>
              <p className="mt-1 text-sm break-words whitespace-pre-wrap">{c.text}</p>
            </li>
          ))}
        </ul>
      )}
    </BlockCard>
  );
}
