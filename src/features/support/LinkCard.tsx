"use client";

import { StatusBadge } from "@/components/shared/StatusBadge";
import type { VisitSummary } from "@/data/access";
import { formatISTDate, istDateOf } from "@/domain/time";
import { LinkActions } from "./LinkActions";

export interface LinkCardProps {
  visit: VisitSummary;
  sendLabel: string;
  onUpdated: (v: VisitSummary) => void;
}

/** One feedback link: customer, vehicle, status badge, link and actions. Never shows answers. */
export function LinkCard({ visit, sendLabel, onUpdated }: LinkCardProps) {
  return (
    <li className="grid min-w-0 gap-3 rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{visit.customerName}</p>
          <p className="text-sm text-muted-foreground">
            {visit.jobCardNo} · {visit.regNo} · {formatISTDate(visit.serviceDate)}
          </p>
        </div>
        <StatusBadge kind={visit.status} />
      </div>
      <p className="min-w-0 truncate text-sm" title={visit.url} data-testid="link-url">
        {visit.url}
      </p>
      <p className="text-xs text-muted-foreground">
        Expires {formatISTDate(istDateOf(visit.expiresAt), { year: true })}
      </p>
      <LinkActions visit={visit} sendLabel={sendLabel} onUpdated={onUpdated} />
    </li>
  );
}
