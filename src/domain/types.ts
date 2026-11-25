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
  { kind: "callback"; slot?: string } | { kind: "low_rating"; code: "Q1" | "Q4" | "Q8" };
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
/** One answer option with how many responses chose it. */
export interface AnswerCount {
  answer: string;
  count: number;
}

/** A follow-up question's option breakdown, merged under its parent question (D-47). */
export interface FollowUpBreakdown {
  code: QuestionCode;
  text: string;
  options: { option: string; count: number }[];
}

/** One question inside an expandable category row: answer bars plus its follow-up breakdown. */
export interface CategoryQuestion {
  code: QuestionCode;
  text: string;
  /** Rating 1-5 counts ("1".."5") or Yes / Partially / No counts; every option listed. */
  answers: AnswerCount[];
  followUp: FollowUpBreakdown | null;
}

export interface OverviewData {
  kpis: {
    responses: Metric;
    responseRate: Metric;
    /** Average of Q1 (overall satisfaction). */
    avgSatisfaction: Metric;
    /** % of Q9 = Yes. */
    recommendRate: Metric;
    /** Count of Q10 = Yes; null with no responses in the period. */
    callbacks: Metric;
    openAlerts: number;
  };
  /** Steps 1-5; `questions` is empty when there are no responses in scope. */
  categoryScores: {
    step: number;
    title: string;
    score: number | null;
    questions: CategoryQuestion[];
  }[];
  trend: {
    granularity: "week" | "month";
    points: {
      bucketStart: ISODate;
      avgSatisfaction: number | null;
      recommendRate: number | null;
    }[];
  };
  /** Sorted by score high to low, unscored (under 3 responses) last, then by name. */
  advisors: {
    advisorId: string;
    name: string;
    /** Display name of the advisor's branch; null when unknown. */
    branchName: string | null;
    responses: number;
    /** Weighted score /100 (whole number); null under 3 responses. */
    score: number | null;
    /** Average Q4 (advisor behaviour). */
    avgBehaviour: number | null;
    /** % Q5 = Yes (delivered on time). */
    onTimePercent: number | null;
    /** Average Q1 (overall satisfaction). */
    avgSatisfaction: number | null;
  }[];
}
