"use client";

import { StatusBadge } from "@/components/shared/StatusBadge";
import type { VisitSummary } from "@/data/access";
import type { LinkIssued } from "@/data/access/repos/visits";
import { formatISTDate, istDateOf } from "@/domain/time";
import { LinkActions } from "./LinkActions";
import { useLinkActions } from "./useLinkActions";

export interface LinkCardProps {
  visit: VisitSummary;
  /** Set only right after generate; the code is never loaded again (G-1). */
  issued?: LinkIssued | null;
  showCreator?: boolean;
  onCancelled: (v: VisitSummary) => void;
}

/** One feedback link: customer, vehicle, status, expiry and actions. Never shows answers. */
export function LinkCard({
  visit,
  issued = null,
  showCreator = false,
  onCancelled,
}: LinkCardProps) {
  const a = useLinkActions(visit, issued, onCancelled);
  const v = a.visit;
  return (
    <li className="grid min-w-0 gap-3 rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{v.customerName ?? "Customer erased"}</p>
          <p className="text-sm text-muted-foreground">
            {[v.jobCardNo, v.regNo, formatISTDate(v.serviceDate)].filter(Boolean).join(" · ")}
          </p>
          {showCreator && (
            <p className="text-sm text-muted-foreground">Created by {v.createdByName}</p>
          )}
        </div>
        <StatusBadge kind={v.status} />
      </div>
      {a.issued !== null && (
        <p className="min-w-0 truncate text-sm" title={a.issued.url} data-testid="link-url">
          {a.issued.url}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Expires {formatISTDate(istDateOf(v.expiresAt), { year: true })}
      </p>
      <LinkActions a={a} />
    </li>
  );
}
