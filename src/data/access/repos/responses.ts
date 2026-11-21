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
  q12: number;
  hasAlert: boolean;
}

export interface ResponseDetail {
  response: ResponseRecord;
  visit: VisitSummary;
  jobCard: JobCard & { advisorName: string };
  questionnaire: Questionnaire;
  alert: Alert | null;
}

export interface DeletedRow {
  id: string;
  customerName: string;
  serviceDate: ISODate;
  deletedAt: ISOTime;
}

export interface ResponseRepo {
  listResponses(f: Filters): Promise<Result<ResponseListRow[]>>;
  getResponse(id: string): Promise<Result<ResponseDetail>>;
  editResponse(id: string, answers: AnswerMap, s: StepUp): Promise<Result<ResponseDetail>>;
  deleteResponse(id: string, s: StepUp): Promise<Result<void>>;
  restoreResponse(id: string, s: StepUp): Promise<Result<void>>;
  listDeleted(): Promise<Result<DeletedRow[]>>;
}
