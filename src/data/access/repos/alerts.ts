import type { Alert, AlertStatus } from "@/domain/types";
import type { Result } from "../result";

export interface AlertView extends Alert {
  customerName: string;
  phone: string | null;
  model: string;
  regNo: string;
  reasonsText: string;
  branchName: string;
  /** Optimistic-lock counter: send it back with updateAlert. */
  version: number;
}

export interface AlertRepo {
  /** newest first, excludes alerts of deleted responses; branchId narrows a main admin only */
  listAlerts(f?: { status?: AlertStatus; branchId?: string }): Promise<Result<AlertView[]>>;
  /** open alerts in the caller's scope */
  countOpen(): Promise<Result<number>>;
  /**
   * audit alert.status (old to new, with the note) or alert.note alone.
   * A stale version gives CONFLICT "Someone else changed this alert. Reload to see the latest."
   */
  updateAlert(
    id: string,
    patch: { status?: AlertStatus; note?: string },
    version: number,
  ): Promise<Result<AlertView>>;
}
