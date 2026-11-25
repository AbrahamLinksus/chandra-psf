import type { Advisor, Branch, Filters, JobCard, OverviewData } from "@/domain/types";
import type { Result } from "../result";

export interface FilterOptions {
  models: string[];
  advisors: Advisor[];
  vehicleTypes: JobCard["vehicleType"][];
  /** Main admin only; absent for a branch admin (no Branch filter is shown). */
  branches?: Branch[];
}

/** `branchId` narrows only for a main admin; a branch admin always gets their own branch. */
export interface AnalyticsFilters extends Filters {
  branchId?: string;
}

export interface AnalyticsRepo {
  getAnalytics(f: AnalyticsFilters): Promise<Result<OverviewData>>;
  getFilterOptions(f?: { branchId?: string }): Promise<Result<FilterOptions>>;
}
