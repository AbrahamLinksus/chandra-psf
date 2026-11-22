import type { ISODate, ISOTime, VisitStatus } from "@/domain/types";
import type { Result } from "../result";

export interface VisitSummary {
  id: string;
  jobCardNo: string;
  customerName: string;
  regNo: string;
  model: string;
  serviceDate: ISODate;
  phone: string | null;
  status: VisitStatus;
  createdAt: ISOTime;
  expiresAt: ISOTime;
  url: string;
  whatsappUrl: string | null;
  /** true when the signed-in user created this link (admins may still change any link) */
  isMine: boolean;
}

export interface VisitRepo {
  /** createdBy = me, current links only (replacedBy null), newest first */
  listMyVisits(q?: { search?: string }): Promise<Result<VisitSummary[]>>;
  /** CONFLICT if a current link exists, ALREADY_COMPLETED */
  createVisitLink(i: { jobCardNo: string; phone: string | null }): Promise<Result<VisitSummary>>;
  /** new visit, old.replacedBy = new.id, audit link.regenerate */
  regenerateLink(visitId: string): Promise<Result<VisitSummary>>;
  /** sets cancelledAt, audit link.cancel */
  cancelLink(visitId: string): Promise<Result<VisitSummary>>;
}
