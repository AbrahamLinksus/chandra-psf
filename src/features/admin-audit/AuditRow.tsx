import { Badge } from "@/components/ui/badge";
import { formatIST } from "@/domain/time";
import type { AuditEntry } from "@/domain/types";
import { ACTION_LABELS } from "./auditFormat";
import { AuditValue } from "./AuditValue";

export function AuditRow({ entry }: { entry: AuditEntry }) {
  return (
    <li className="grid gap-2 rounded-2xl border bg-card p-4 shadow-sm" data-testid="audit-row">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge variant="outline">{ACTION_LABELS[entry.action]}</Badge>
        <time dateTime={entry.at} className="text-sm text-muted-foreground">
          {formatIST(entry.at)} IST
        </time>
      </div>
      <p className="text-sm">
        <span className="font-medium">{entry.actorName}</span>
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
