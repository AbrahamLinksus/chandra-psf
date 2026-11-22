import { Progress } from "@/components/ui/progress";
import type { OverviewData } from "@/domain/types";
import { BlockCard, NoData } from "./BlockCard";
import { questionText } from "./questionLabels";

type Detail = OverviewData["questionDetail"][number];

function Split({ item }: { item: Detail }) {
  const total = item.split.reduce((n, s) => n + s.count, 0);
  return (
    <li className="grid gap-1.5" data-testid="question-detail">
      <p className="text-sm font-medium">
        {item.code} · {questionText(item.code)}
      </p>
      {item.split.map((s) => (
        <div key={s.answer} className="grid grid-cols-[5rem_1fr_3.5rem] items-center gap-2 text-sm">
          <span>{s.answer}</span>
          <Progress
            value={total === 0 ? 0 : (s.count / total) * 100}
            aria-label={`${item.code} ${s.answer}`}
          />
          <span className="text-right tabular-nums">{s.count}</span>
        </div>
      ))}
    </li>
  );
}

export function QuestionDetail({ detail }: { detail: OverviewData["questionDetail"] }) {
  const empty = detail.every((d) => d.split.every((s) => s.count === 0));
  return (
    <BlockCard title="Question-level detail" className="lg:col-span-2">
      {empty ? (
        <NoData />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {detail.map((d) => (
            <Split key={d.code} item={d} />
          ))}
        </ul>
      )}
    </BlockCard>
  );
}
