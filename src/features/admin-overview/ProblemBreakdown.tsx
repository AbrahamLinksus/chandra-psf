"use client";

import { useState } from "react";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { OverviewData } from "@/domain/types";
import { BlockCard, NoData } from "./BlockCard";
import { questionText } from "./questionLabels";

type Code = keyof OverviewData["problems"];

export function ProblemBreakdown({ problems }: { problems: OverviewData["problems"] }) {
  const codes = Object.keys(problems) as Code[];
  const [code, setCode] = useState<Code>(codes[0] ?? "Q1a");
  const rows = problems[code];
  const max = Math.max(1, ...rows.map((r) => r.count));
  const total = rows.reduce((n, r) => n + r.count, 0);
  return (
    <BlockCard
      title="Problem breakdown"
      action={
        <div className="flex items-center gap-2">
          <Select
            value={code}
            onValueChange={(v) => {
              setCode(v as Code);
            }}
          >
            <SelectTrigger className="h-12 w-52" aria-label="Follow-up question">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {codes.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
    >
      <p className="text-sm text-muted-foreground">{questionText(code)}</p>
      {total === 0 ? (
        <NoData />
      ) : (
        <ul className="grid gap-2">
          {rows.map((r) => (
            <li key={r.option} className="grid gap-1">
              <div className="flex justify-between gap-2 text-sm">
                <span>{r.option}</span>
                <span className="tabular-nums">{r.count}</span>
              </div>
              <Progress value={(r.count / max) * 100} aria-label={r.option} />
            </li>
          ))}
        </ul>
      )}
    </BlockCard>
  );
}
