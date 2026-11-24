import type { JobCard } from "@/domain/types";
import type { Result } from "../result";
import type { VisitSummary } from "./visits";

export interface JobCardView extends JobCard {
  id: string;
  advisorName: string;
  branchName: string;
  /** no completed visit and not erased */
  editable: boolean;
}

/** What the New job card form sends (raw; the server validates and normalises). */
export interface JobCardInput {
  jobCardNo: string;
  customerName: string;
  phone: string | null;
  regNo: string;
  model: string;
  /** when `model` is "Other" */
  modelOther?: string;
  /** when `model` is "Other" */
  vehicleType?: JobCard["vehicleType"];
  serviceType: string;
  serviceDate: string;
  advisorId: string;
}

export interface JobCardRepo {
  /** own branch only; NOT_FOUND "No job card JC-… at this branch yet" */
  getJobCard(
    jobCardNo: string,
  ): Promise<Result<{ jobCard: JobCardView; current: VisitSummary | null }>>;
  /** VALIDATION (fields); CONFLICT fields ['jobCardNo']; the same requestId again returns the saved card */
  createJobCard(i: JobCardInput & { requestId: string }): Promise<Result<JobCardView>>;
  /** CONFLICT "Feedback already received" when not editable; audit jobcard.update old to new */
  updateJobCard(id: string, patch: Partial<JobCardInput>): Promise<Result<JobCardView>>;
  listFreshJobCards(): Promise<Result<string[]>>;
}
