import type { JobCard } from "@/domain/types";
import type { Result } from "../result";
import type { VisitSummary } from "./visits";

export interface JobCardRepo {
  /** NOT_FOUND */
  getJobCard(
    jobCardNo: string,
  ): Promise<Result<{ jobCard: JobCard & { advisorName: string }; current: VisitSummary | null }>>;
  listFreshJobCards(): Promise<Result<string[]>>;
}
