import type { Advisor, Filters, JobCard, OverviewData } from "@/domain/types";
import type { Result } from "../result";

export interface FilterOptions {
  models: string[];
  advisors: Advisor[];
  vehicleTypes: JobCard["vehicleType"][];
}

export interface AnalyticsRepo {
  getAnalytics(f: Filters): Promise<Result<OverviewData>>;
  getFilterOptions(): Promise<Result<FilterOptions>>;
}
