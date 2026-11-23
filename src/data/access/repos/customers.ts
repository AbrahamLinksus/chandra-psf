import type { VisitStatus } from "@/domain/types";
import type { Result, StepUp } from "../result";

export interface CustomerRow {
  jobCardId: string;
  branchName: string;
  serviceDate: string;
  customerName: string | null;
  regNo: string | null;
  linkStatus: VisitStatus | null;
  hasResponse: boolean;
  erased: boolean;
}

export interface CustomerRepo {
  /** main admin only */
  searchCustomers(q: { phone?: string; regNo?: string }): Promise<Result<CustomerRow[]>>;
  /** audit customer.export */
  exportCustomers(jobCardIds: string[]): Promise<Result<{ filename: string; csv: string }>>;
  /** step-up; audit customer.erase */
  eraseCustomers(jobCardIds: string[], s: StepUp): Promise<Result<{ erased: number }>>;
}
