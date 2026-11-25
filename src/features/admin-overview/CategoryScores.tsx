"use client";

import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import { MetricValue } from "@/components/shared/MetricValue";
import { Progress } from "@/components/ui/progress";
import type { OverviewData } from "@/domain/types";
import { BlockCard } from "./BlockCard";
import { QuestionBars } from "./QuestionBars";

type Category = OverviewData["categoryScores"][number];

function CategoryRow({ category }: { category: Category }) {
  const [open, setOpen] = useState(false);
  const panelId = `category-${String(category.step)}`;
  return (
    <li className="grid gap-2" data-testid="category-row">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        className="grid min-h-12 gap-1 text-left"
        onClick={() => {
          setOpen((o) => !o);
        }}
      >
        <span className="flex items-center justify-between gap-2 text-sm">
          <span className="flex min-w-0 items-center gap-1">
            <ChevronDownIcon
              className={`size-4 shrink-0 transition-transform ${open ? "" : "-rotate-90"}`}
              aria-hidden
            />
            <span className="min-w-0">{category.title}</span>
          </span>
          <span className="font-medium whitespace-nowrap" data-testid="category-score">
            <MetricValue value={category.score} format="count" />
            {category.score !== null && <span className="text-muted-foreground"> / 100</span>}
          </span>
        </span>
        <Progress
          value={category.score ?? 0}
          className="h-3"
          aria-label={`${category.title} score`}
        />
      </button>
      <div id={panelId} hidden={!open}>
        {open && <QuestionBars questions={category.questions} />}
      </div>
    </li>
  );
}

export function CategoryScores({ scores }: { scores: OverviewData["categoryScores"] }) {
  return (
    <BlockCard title="Category scores" className="lg:col-span-2 xl:col-span-3">
      <ul className="grid gap-3">
        {scores.map((s) => (
          <CategoryRow key={s.step} category={s} />
        ))}
      </ul>
    </BlockCard>
  );
}
