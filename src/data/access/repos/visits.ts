import type { ISODate, ISOTime, VisitStatus } from "@/domain/types";
import type { Result } from "../result";

/** One current link as the staff lists show it. Never carries the code, answers or ratings. */
export interface VisitSummary {
  id: string;
  jobCardId: string;
  jobCardNo: string;
  /** null once the customer's data is erased */
  customerName: string | null;
  /** null once the customer's data is erased */
  regNo: string | null;
  model: string;
  serviceDate: ISODate;
  phone: string | null;
  status: VisitStatus;
  createdAt: ISOTime;
  expiresAt: ISOTime;
  createdByName: string;
  /** true when the signed-in user created this link */
  mine: boolean;
}

/** The only time a link code leaves the server: returned by create, resend and regenerate. */
export interface LinkIssued {
  visit: VisitSummary;
  /** `APP_URL/f/<43-char code>` */
  url: string;
  /** SPEC section 5 wa.me link; null when the job card has no mobile number */
  whatsappUrl: string | null;
}

export interface VisitRepo {
  /** current links only (replacedBy null), newest first, max 200; `branch` = the user's branch (all branches for the main admin) */
  listVisits(q: { scope: "mine" | "branch"; search?: string }): Promise<Result<VisitSummary[]>>;
  /** NOT_FOUND, ALREADY_COMPLETED, CONFLICT (a live link exists), VALIDATION (erased); audit link.create */
  createVisitLink(i: { jobCardId: string }): Promise<Result<LinkIssued>>;
  /** new code, same visit and expiry, old code superseded; CONFLICT "This link can no longer be changed"; audit link.resend */
  resendLink(visitId: string): Promise<Result<LinkIssued>>;
  /** new visit valid 7 days, old.replacedBy = new.id; CONFLICT when completed, cancelled or replaced; audit link.regenerate */
  regenerateLink(visitId: string): Promise<Result<LinkIssued>>;
  /** sets cancelledAt, supersedes the code; audit link.cancel */
  cancelLink(visitId: string): Promise<Result<VisitSummary>>;
}
