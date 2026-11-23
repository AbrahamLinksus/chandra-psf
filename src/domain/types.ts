import type { StaffRole } from "./roles";

export type Role = StaffRole;
export type ISODate = string; // YYYY-MM-DD, IST
export type ISOTime = string; // UTC ISO

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  mustSetPassword: boolean;
  branchId: string | null;
  branchName: string | null;
  lastSignInAt: ISOTime | null;
  createdAt: ISOTime;
}
export interface Branch {
  id: string;
  name: string;
  city: string;
  active: boolean;
  createdAt: ISOTime;
}
export interface Advisor {
  id: string;
  name: string;
  branchId: string;
  active: boolean;
}
export interface JobCard {
  jobCardNo: string;
  customerName: string;
  phone: string | null;
  regNo: string;
  model: string;
  vehicleType: "scooter" | "motorcycle";
  serviceType: string;
  serviceDate: ISODate;
  advisorId: string;
}
export interface Visit {
  id: string;
  jobCardNo: string;
  phone: string | null;
  token: string;
  createdBy: string;
  createdAt: ISOTime;
  expiresAt: ISOTime;
  openedAt: ISOTime | null;
  completedAt: ISOTime | null;
  cancelledAt: ISOTime | null;
  replacedBy: string | null;
}
export type VisitStatus = "created" | "opened" | "completed" | "expired" | "cancelled";

export type QuestionCode = `Q${number}` | `Q${number}a`;
export type AnswerValue = number | string | { options: string[]; text?: string };
export type AnswerMap = Partial<Record<QuestionCode, AnswerValue>>;
export interface ResponseRecord {
  id: string;
  visitId: string;
  questionsVersion: number;
  submittedAt: ISOTime;
  answers: AnswerMap;
  deletedAt: ISOTime | null;
}

export type AlertReason =
  { kind: "callback" } | { kind: "low_rating"; code: "Q1" | "Q6" | "Q11" | "Q12" };
export type AlertStatus = "open" | "contacted" | "resolved";
export interface AlertNote {
  at: ISOTime;
  by: string;
  text: string;
}
export interface Alert {
  id: string;
  responseId: string;
  reasons: AlertReason[];
  status: AlertStatus;
  notes: AlertNote[];
  createdAt: ISOTime;
  updatedAt: ISOTime;
}

export type AuditAction =
  | "link.create"
  | "link.regenerate"
  | "link.cancel"
  | "response.edit"
  | "response.delete"
  | "response.restore"
  | "alert.create"
  | "alert.status"
  | "alert.note"
  | "user.create"
  | "user.deactivate"
  | "user.reactivate"
  | "user.set_password"
  | "auth.sign_in"
  | "auth.lockout"
  | "user.update"
  | "user.reset_password"
  | "user.change_password"
  | "user.otp_reissue"
  | "user.recover"
  | "jobcard.create"
  | "jobcard.update"
  | "link.resend"
  | "branch.create"
  | "branch.update"
  | "branch.deactivate"
  | "branch.reactivate"
  | "advisor.create"
  | "advisor.update"
  | "advisor.deactivate"
  | "advisor.reactivate"
  | "customer.export"
  | "customer.erase"
  | "response.purge"
  | "system.cleanup";
export interface AuditEntry {
  id: string;
  at: ISOTime;
  actorId: string;
  actorName: string;
  action: AuditAction;
  entityType: "visit" | "response" | "alert" | "user";
  entityId: string;
  oldValue: unknown;
  newValue: unknown;
  note?: string;
}

export interface Filters {
  from: ISODate;
  to: ISODate;
  vehicleType?: JobCard["vehicleType"];
  model?: string;
  advisorId?: string;
}

/** Overview analytics shapes (LLD 1.4). Declared here so the data-access layer can name them;
 * the computation (`metrics/`) is owned by T-06. */
export interface AnalyticsInput {
  visits: { visit: Visit; jobCard: JobCard }[];
  responses: { response: ResponseRecord; visit: Visit; jobCard: JobCard }[];
  openAlerts: number;
  now: Date;
}
export interface Metric {
  value: number | null;
  previous: number | null;
  delta: number | null;
}
export interface OverviewData {
  kpis: {
    responses: Metric;
    responseRate: Metric;
    avgQ12: Metric;
    recommendRate: Metric;
    openAlerts: number;
  };
  categoryScores: { step: number; title: string; score: number | null }[];
  trend: {
    granularity: "week" | "month";
    points: { bucketStart: ISODate; avgQ12: number | null; recommendRate: number | null }[];
  };
  advisors: {
    advisorId: string;
    name: string;
    responses: number;
    avgQ6: number | null;
    q4Yes: number | null;
    q7Yes: number | null;
    avgQ12: number | null;
  }[];
  problems: Record<
    "Q1a" | "Q3a" | "Q6a" | "Q7a" | "Q9a" | "Q11a",
    { option: string; count: number }[]
  >;
  questionDetail: { code: QuestionCode; split: { answer: string; count: number }[] }[];
  comments: {
    responseId: string;
    serviceDate: ISODate;
    source: QuestionCode;
    text: string;
    q12: number;
  }[];
}
