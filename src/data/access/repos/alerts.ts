import type { Alert, AlertStatus } from "@/domain/types";
import type { Result } from "../result";

export interface AlertView extends Alert {
  customerName: string;
  phone: string | null;
  model: string;
  regNo: string;
  reasonsText: string;
}

export interface AlertRepo {
  /** newest first, excludes alerts of deleted responses */
  listAlerts(f?: { status?: AlertStatus }): Promise<Result<AlertView[]>>;
  countOpen(): Promise<Result<number>>;
  /** audit alert.status (old to new) and/or alert.note */
  updateAlert(id: string, patch: { status?: AlertStatus; note?: string }): Promise<Result<AlertView>>;
}
