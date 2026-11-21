import type { AlertRepo } from "./repos/alerts";
import type { AnalyticsRepo } from "./repos/analytics";
import type { AuditRepo } from "./repos/audit";
import type { AuthRepo } from "./repos/auth";
import type { DemoRepo } from "./repos/demo";
import type { FeedbackRepo } from "./repos/feedback";
import type { JobCardRepo } from "./repos/jobCards";
import type { ResponseRepo } from "./repos/responses";
import type { UserRepo } from "./repos/users";
import type { VisitRepo } from "./repos/visits";
import type { Topic } from "./result";

export interface DataAccess {
  auth: AuthRepo;
  demo: DemoRepo;
  jobCards: JobCardRepo;
  visits: VisitRepo;
  feedback: FeedbackRepo;
  analytics: AnalyticsRepo;
  alerts: AlertRepo;
  responses: ResponseRepo;
  audit: AuditRepo;
  users: UserRepo;
  subscribe(listener: (topics: Topic[]) => void): () => void;
}

export * from "./result";
export type { AlertRepo, AlertView } from "./repos/alerts";
export type { AnalyticsRepo, FilterOptions } from "./repos/analytics";
export type { AuditRepo } from "./repos/audit";
export type { AuthRepo } from "./repos/auth";
export type { DemoRepo } from "./repos/demo";
export type { FeedbackRepo, FormContext } from "./repos/feedback";
export type { JobCardRepo } from "./repos/jobCards";
export type { DeletedRow, ResponseDetail, ResponseListRow, ResponseRepo } from "./repos/responses";
export type { UserRepo } from "./repos/users";
export type { VisitRepo, VisitSummary } from "./repos/visits";
