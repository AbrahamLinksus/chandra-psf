import { err, ok, type Result } from "@/data/access/result";
import type { JobCardInput } from "@/data/access/repos/jobCards";
import { jobCardInputSchema, type JobCardInputParsed } from "@/domain/jobCardInput";
import { HONDA_MODELS, OTHER_MODEL } from "@/domain/models";
import { normalizeJobCardNo } from "@/domain/jobCard";
import { toWhatsAppNumber } from "@/domain/phone";
import type { jobCards } from "../db/schema";

export type JobCardRow = typeof jobCards.$inferSelect;

/** Columns a create or update writes, derived from one validated input. */
export interface JobCardColumns {
  jobCardNo: string;
  jobCardKey: string;
  customerName: string;
  phone: string | null;
  phoneKey: string | null;
  regNo: string;
  regNoKey: string;
  model: string;
  vehicleType: "scooter" | "motorcycle";
  serviceType: string;
  serviceDate: string;
  advisorId: string;
}

export const COLUMN_NAMES = [
  "jobCardNo",
  "customerName",
  "phone",
  "regNo",
  "model",
  "vehicleType",
  "serviceType",
  "serviceDate",
  "advisorId",
] as const;

export const NO_ADVISORS = "Ask your admin to add advisors for this branch";
export const NOT_EDITABLE = "Feedback already received";
export const ACCOUNT_DISABLED = "Account disabled, contact admin";

export function existsMessage(jobCardNo: string): string {
  return `${jobCardNo} already exists at this branch`;
}

export function notFoundMessage(typed: string): string {
  return `No job card ${typed.trim().toUpperCase()} at this branch yet`;
}

/** The stored card in the shape the form sends, so a patch can be merged and re-validated. */
export function inputOf(row: JobCardRow): JobCardInput {
  const known = Object.hasOwn(HONDA_MODELS, row.model) && row.model !== OTHER_MODEL;
  return {
    jobCardNo: row.jobCardNo,
    customerName: row.customerName ?? "",
    phone: row.phone,
    regNo: row.regNo ?? "",
    model: known ? row.model : OTHER_MODEL,
    ...(known ? {} : { modelOther: row.model }),
    vehicleType: row.vehicleType,
    serviceType: row.serviceType,
    serviceDate: row.serviceDate,
    advisorId: row.advisorId,
  };
}

export function parseInput(raw: unknown, now: Date): Result<JobCardInputParsed> {
  const parsed = jobCardInputSchema(now).safeParse(raw);
  if (parsed.success) return ok(parsed.data);
  const fields = [...new Set(parsed.error.issues.map((i) => String(i.path[0] ?? "")))].filter(
    (f) => f !== "",
  );
  const message = parsed.error.issues[0]?.message ?? "Check the details and try again";
  return err("VALIDATION", message, fields);
}

export function columnsOf(v: JobCardInputParsed): JobCardColumns {
  const wa = toWhatsAppNumber(v.phone);
  return {
    jobCardNo: v.jobCardNo.toUpperCase(),
    jobCardKey: normalizeJobCardNo(v.jobCardNo),
    customerName: v.customerName,
    phone: v.phone,
    phoneKey: wa === null ? null : wa.slice(2),
    regNo: v.regNo,
    regNoKey: v.regNo.replace(/\s+/g, "").toUpperCase(),
    model: v.model === OTHER_MODEL ? (v.modelOther ?? v.model) : v.model,
    vehicleType: v.vehicleType ?? "scooter",
    serviceType: v.serviceType,
    serviceDate: v.serviceDate,
    advisorId: v.advisorId,
  };
}

/** Audit payload of the changed fields only: old values and new values. */
export function diffColumns(
  before: JobCardRow,
  after: JobCardColumns,
): { old: Record<string, unknown>; next: Record<string, unknown> } | null {
  const old: Record<string, unknown> = {};
  const next: Record<string, unknown> = {};
  for (const k of COLUMN_NAMES) {
    if (before[k] !== after[k]) {
      old[k] = before[k];
      next[k] = after[k];
    }
  }
  return Object.keys(next).length === 0 ? null : { old, next };
}
