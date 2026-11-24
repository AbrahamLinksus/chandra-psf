import { StatusBadge } from "@/components/shared/StatusBadge";
import type { AlertView } from "@/data/access/repos/alerts";
import type { AlertStatus } from "@/domain/types";
import { formatIST } from "@/domain/time";
import { cn } from "@/lib/utils";

const TINT: Record<AlertStatus, string> = {
  open: "bg-danger-soft/50 border-danger/30",
  contacted: "bg-warning-soft/60 border-warning/30",
  resolved: "bg-success-soft/50 border-success/30",
};

export function AlertRow({
  alert,
  showBranch,
  onOpen,
}: {
  alert: AlertView;
  showBranch: boolean;
  onOpen: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        data-status={alert.status}
        data-alert-id={alert.id}
        className={cn(
          "flex min-h-14 w-full flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-left",
          TINT[alert.status],
        )}
      >
        <span className="grid gap-0.5">
          <span className="font-medium">{alert.customerName}</span>
          <span className="text-sm text-muted-foreground">{alert.reasonsText}</span>
          <span className="text-xs text-muted-foreground">
            {showBranch && (
              <span data-testid="alert-branch" className="font-medium">
                {alert.branchName}
                {" · "}
              </span>
            )}
            {formatIST(alert.createdAt)}
          </span>
        </span>
        <StatusBadge kind={alert.status} />
      </button>
    </li>
  );
}
