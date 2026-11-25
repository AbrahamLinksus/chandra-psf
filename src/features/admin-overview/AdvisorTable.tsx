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
import { sortAdvisors, type AdvisorRow, type AdvisorSortKey, type SortDir } from "./advisorSort";
import { BlockCard, NoData } from "./BlockCard";

interface Column {
  key: AdvisorSortKey;
  label: string;
  format?: MetricFormat;
}

const NAME: Column = { key: "name", label: "Advisor" };
const BRANCH: Column = { key: "branchName", label: "Branch" };
const METRICS: Column[] = [
  { key: "responses", label: "Responses", format: "count" },
  { key: "score", label: "Score", format: "count" },
  { key: "avgBehaviour", label: "Avg advisor behaviour", format: "score" },
  { key: "onTimePercent", label: "% on time", format: "percent" },
  { key: "avgSatisfaction", label: "Avg overall satisfaction", format: "score" },
];

interface Sort {
  key: AdvisorSortKey;
  dir: SortDir;
}
type OnSort = (k: AdvisorSortKey) => void;

function SortHead(props: { col: Column; sort: Sort; onSort: OnSort }) {
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

function Cell({ row, col }: { row: AdvisorRow; col: Column }) {
  const v = row[col.key];
  if (col.format === undefined) return <>{v ?? "—"}</>;
  const value = typeof v === "number" ? v : null;
  if (col.key === "score") {
    return (
      <span data-testid="advisor-score">
        <MetricValue value={value} format="count" />
        {value !== null && <span className="text-muted-foreground"> /100</span>}
      </span>
    );
  }
  return <MetricValue value={value} format={col.format} />;
}

function AdvisorCards({ rows, columns }: { rows: AdvisorRow[]; columns: Column[] }) {
  return (
    <ul className="grid gap-3 md:hidden">
      {rows.map((r) => (
        <li
          key={r.advisorId}
          data-testid="advisor-card"
          className="grid gap-1 rounded-xl border p-3"
        >
          <p className="font-medium">{r.name}</p>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
            {columns
              .filter((c) => c.key !== "name")
              .map((c) => (
                <div key={c.key} className="contents">
                  <dt className="text-muted-foreground">{c.label}</dt>
                  <dd className="text-right">
                    <Cell row={r} col={c} />
                  </dd>
                </div>
              ))}
          </dl>
        </li>
      ))}
    </ul>
  );
}

function AdvisorGrid(props: { rows: AdvisorRow[]; columns: Column[]; sort: Sort; onSort: OnSort }) {
  const { rows, columns, sort, onSort } = props;
  return (
    <div className="hidden md:block">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <SortHead key={c.key} col={c} sort={sort} onSort={onSort} />
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.advisorId} data-testid="advisor-row">
              {columns.map((c) => (
                <TableCell key={c.key} className="px-2">
                  <Cell row={r} col={c} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Sort buttons for the stacked (mobile) cards; the table headers sort on desktop. */
function CardSort(props: { columns: Column[]; sort: Sort; onSort: OnSort }) {
  const { columns, sort, onSort } = props;
  return (
    <div className="flex flex-wrap gap-2 md:hidden" role="group" aria-label="Sort advisors by">
      {columns.map((c) => (
        <button
          key={c.key}
          type="button"
          aria-pressed={sort.key === c.key}
          className="min-h-12 rounded-full border px-3 text-sm aria-pressed:bg-primary aria-pressed:text-primary-foreground"
          onClick={() => {
            onSort(c.key);
          }}
        >
          {c.label}
          {sort.key === c.key && (sort.dir === "asc" ? " ↑" : " ↓")}
        </button>
      ))}
    </div>
  );
}

export function AdvisorTable(props: { advisors: OverviewData["advisors"]; showBranch: boolean }) {
  const [sort, setSort] = useState<Sort>({ key: "score", dir: "desc" });
  const onSort: OnSort = (key) => {
    setSort((s) => ({ key, dir: s.key === key && s.dir === "desc" ? "asc" : "desc" }));
  };
  const columns = props.showBranch ? [NAME, BRANCH, ...METRICS] : [NAME, ...METRICS];
  const rows = sortAdvisors(props.advisors, sort.key, sort.dir);
  return (
    <BlockCard title="Advisor performance" className="lg:col-span-2 xl:col-span-3">
      {rows.length === 0 ? (
        <NoData />
      ) : (
        <>
          <CardSort columns={columns} sort={sort} onSort={onSort} />
          <AdvisorCards rows={rows} columns={columns} />
          <AdvisorGrid rows={rows} columns={columns} sort={sort} onSort={onSort} />
        </>
      )}
    </BlockCard>
  );
}
