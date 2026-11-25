import type { Questionnaire } from "@/domain/questionnaire";
import type { Alert, AnswerMap, Filters, ISODate, ISOTime, JobCard, ResponseRecord } from "@/domain/types";
import type { Result, StepUp } from "../result";
import type { VisitSummary } from "./visits";

export interface ResponseListRow {
  id: string;
  serviceDate: ISODate;
  customerName: string;
  model: string;
  advisorName: string;
  branchName: string;
  q12: number;
  hasAlert: boolean;
}

export interface ResponseDetail {
  response: ResponseRecord;
  visit: VisitSummary;
  jobCard: JobCard & { advisorName: string };
  questionnaire: Questionnaire;
  alert: Alert | null;
  branchName: string;
  /** send this back with an edit; a stale one gets CONFLICT */
  version: number;
}

export interface DeletedRow {
  id: string;
  customerName: string;
  serviceDate: ISODate;
  deletedAt: ISOTime;
  branchName: string;
  /** IST date the daily clean-up removes it for good */
  purgeOn: ISODate;
}

/** `branchId` narrows only for the main admin; a branch admin always gets their own branch. */
export type ResponseFilters = Filters & { branchId?: string };

export interface ResponseRepo {
  listResponses(f: ResponseFilters): Promise<Result<ResponseListRow[]>>;
  getResponse(id: string): Promise<Result<ResponseDetail>>;
  /** step-up password; CONFLICT "Someone else changed this. Reload to see the latest." on a stale version */
  editResponse(
    id: string,
    answers: AnswerMap,
    version: number,
    s: StepUp,
  ): Promise<Result<ResponseDetail>>;
  deleteResponse(id: string, s: StepUp): Promise<Result<void>>;
  restoreResponse(id: string, s: StepUp): Promise<Result<void>>;
  listDeleted(): Promise<Result<DeletedRow[]>>;
}
