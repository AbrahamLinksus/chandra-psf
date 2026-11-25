import { Progress } from "@/components/ui/progress";
import type { AnswerCount, CategoryQuestion } from "@/domain/types";

const RATING = /^[1-5]$/;
const label = (answer: string) => (RATING.test(answer) ? `Rating ${answer}` : answer);

function Bars({ items }: { items: { name: string; count: number }[] }) {
  const total = items.reduce((sum, i) => sum + i.count, 0);
  return (
    <ul className="grid gap-1">
      {items.map((i) => (
        <li key={i.name} className="grid grid-cols-[minmax(0,7rem)_1fr_2rem] items-center gap-2">
          <span className="truncate text-xs" title={i.name}>
            {i.name}
          </span>
          <Progress
            value={total === 0 ? 0 : (i.count / total) * 100}
            className="h-2"
            aria-label={`${i.name} share`}
          />
          <span className="text-right text-xs tabular-nums">{i.count}</span>
        </li>
      ))}
    </ul>
  );
}

const fromAnswers = (a: AnswerCount[]) => a.map((x) => ({ name: label(x.answer), count: x.count }));

function QuestionBlock({ q }: { q: CategoryQuestion }) {
  return (
    <li className="grid gap-2 rounded-xl border p-3" data-testid="category-question">
      <p className="text-sm font-medium">{q.text}</p>
      <Bars items={fromAnswers(q.answers)} />
      {q.followUp && (
        <div className="grid gap-1 border-l-2 pl-3" data-testid="follow-up">
          <p className="text-xs text-muted-foreground">{q.followUp.text}</p>
          <Bars items={q.followUp.options.map((o) => ({ name: o.option, count: o.count }))} />
        </div>
      )}
    </li>
  );
}

export function QuestionBars({ questions }: { questions: CategoryQuestion[] }) {
  if (questions.length === 0) return <p className="text-sm text-muted-foreground">—</p>;
  return (
    <ul className="grid gap-3">
      {questions.map((q) => (
        <QuestionBlock key={q.code} q={q} />
      ))}
    </ul>
  );
}
