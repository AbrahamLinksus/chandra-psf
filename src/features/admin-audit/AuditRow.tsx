import { Badge } from "@/components/ui/badge";
import { formatIST } from "@/domain/time";
import type { AuditEntryView } from "@/data/access/repos/audit";
import { actionLabel } from "./auditFormat";
import { AuditValue } from "./AuditValue";

export function AuditRow({ entry }: { entry: AuditEntryView }) {
  return (
    <li
      className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2 rounded-2xl border bg-card p-4 [overflow-wrap:anywhere] shadow-sm"
      data-testid="audit-row"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge variant="outline">{actionLabel(entry.action)}</Badge>
        <time dateTime={entry.at} className="text-sm text-muted-foreground">
          {formatIST(entry.at)} IST
        </time>
      </div>
      <p className="text-sm">
        <span className="font-medium">{entry.actorName}</span>
        <span className="text-muted-foreground"> · {entry.branchName ?? "All branches"}</span>
        <span className="text-muted-foreground">
          {" "}
          · {entry.entityType} {entry.entityId}
        </span>
      </p>
      {entry.note !== undefined && <p className="text-sm">{entry.note}</p>}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
        <AuditValue label="Old" value={entry.oldValue} />
        <span aria-hidden className="hidden pt-5 sm:block">
          →
        </span>
        <AuditValue label="New" value={entry.newValue} />
      </div>
    </li>
  );
}
