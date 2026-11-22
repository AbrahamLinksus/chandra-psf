"use client";

import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { useState } from "react";
import { MetricValue } from "@/components/shared/MetricValue";
import type { MetricFormat } from "@/components/shared/formatMetric";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { OverviewData } from "@/domain/types";
import { sortAdvisors, type AdvisorSortKey, type SortDir } from "./advisorSort";
import { BlockCard, NoData } from "./BlockCard";

const COLUMNS: { key: AdvisorSortKey; label: string; format?: MetricFormat }[] = [
  { key: "name", label: "Advisor" },
  { key: "responses", label: "Responses", format: "count" },
  { key: "avgQ6", label: "Avg Q6", format: "score" },
  { key: "q4Yes", label: "% Q4 Yes", format: "percent" },
  { key: "q7Yes", label: "% Q7 Yes", format: "percent" },
  { key: "avgQ12", label: "Avg Q12", format: "score" },
];

function SortHead(props: {
  col: (typeof COLUMNS)[number];
  sort: { key: AdvisorSortKey; dir: SortDir };
  onSort: (k: AdvisorSortKey) => void;
}) {
  const { col, sort, onSort } = props;
  const active = sort.key === col.key;
  const Icon = sort.dir === "asc" ? ArrowUpIcon : ArrowDownIcon;
  return (
    <TableHead
      className="px-2"
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        className="flex min-h-12 items-center gap-1 font-medium whitespace-nowrap"
        onClick={() => {
          onSort(col.key);
        }}
      >
        {col.label}
        {active && <Icon className="size-4" aria-hidden />}
      </button>
    </TableHead>
  );
}

const numberOrNull = (v: unknown): number | null => (typeof v === "number" ? v : null);

export function AdvisorTable({ advisors }: { advisors: OverviewData["advisors"] }) {
  const [sort, setSort] = useState<{ key: AdvisorSortKey; dir: SortDir }>({
    key: "responses",
    dir: "desc",
  });
  const onSort = (key: AdvisorSortKey) => {
    setSort((s) => ({ key, dir: s.key === key && s.dir === "desc" ? "asc" : "desc" }));
  };
  const rows = sortAdvisors(advisors, sort.key, sort.dir);
  return (
    <BlockCard title="Advisor performance" className="lg:col-span-2">
      {rows.length === 0 ? (
        <NoData />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {COLUMNS.map((c) => (
                <SortHead key={c.key} col={c} sort={sort} onSort={onSort} />
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.advisorId} data-testid="advisor-row">
                {COLUMNS.map((c) => (
                  <TableCell key={c.key} className="px-2">
                    {c.format === undefined ? (
                      r.name
                    ) : (
                      <MetricValue value={numberOrNull(r[c.key])} format={c.format} />
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </BlockCard>
  );
}
