import { Badge } from "@/components/ui/badge";
import type { AlertStatus, VisitStatus } from "@/domain/types";

export type StatusKind = VisitStatus | AlertStatus;

const NEUTRAL = "border-transparent bg-secondary text-muted-foreground";
const GREEN = "border-transparent bg-success-soft text-success";
const AMBER = "border-transparent bg-warning-soft text-warning";
const RED = "border-transparent bg-danger-soft text-danger";

/** One colour map for every status in the app. */
const STATUS: Record<StatusKind, { label: string; className: string }> = {
  created: { label: "Created", className: NEUTRAL },
  opened: { label: "Opened", className: AMBER },
  completed: { label: "Completed", className: GREEN },
  expired: { label: "Expired", className: RED },
  cancelled: { label: "Cancelled", className: NEUTRAL },
  open: { label: "Open", className: RED },
  contacted: { label: "Contacted", className: AMBER },
  resolved: { label: "Resolved", className: GREEN },
};

export function StatusBadge({ kind }: { kind: StatusKind }) {
  const { label, className } = STATUS[kind];
  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  );
}
