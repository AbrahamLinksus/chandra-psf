import { z } from "zod";
import type {
  Advisor,
  Alert,
  AlertReason,
  AnswerMap,
  AnswerValue,
  AuditEntry,
  Branch,
  JobCard,
  ResponseRecord,
  User,
  Visit,
} from "./types";

const iso = z.string().min(1);
const isoOrNull = iso.nullable();

export const AnswerValueSchema: z.ZodType<AnswerValue> = z.union([
  z.number(),
  z.string(),
  z.object({ options: z.array(z.string()), text: z.string().exactOptional() }),
]);

const CODE = /^Q\d+a?$/;
export const AnswerMapSchema: z.ZodType<AnswerMap> = z.custom<AnswerMap>((v) => {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  return Object.entries(v).every(
    ([k, val]) => CODE.test(k) && AnswerValueSchema.safeParse(val).success,
  );
});

export const UserSchema: z.ZodType<User> = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.enum(["support", "branch_admin", "main_admin"]),
  active: z.boolean(),
  mustSetPassword: z.boolean(),
  branchId: z.string().nullable(),
  branchName: z.string().nullable(),
  lastSignInAt: isoOrNull,
  createdAt: iso,
});
export const BranchSchema: z.ZodType<Branch> = z.object({
  id: z.string(),
  name: z.string(),
  city: z.string(),
  active: z.boolean(),
  createdAt: iso,
});
export const AdvisorSchema: z.ZodType<Advisor> = z.object({
  id: z.string(),
  name: z.string(),
  branchId: z.string(),
  active: z.boolean(),
});

export const JobCardSchema: z.ZodType<JobCard> = z.object({
  jobCardNo: z.string(),
  customerName: z.string(),
  phone: z.string().nullable(),
  regNo: z.string(),
  model: z.string(),
  vehicleType: z.enum(["scooter", "motorcycle"]),
  serviceType: z.string(),
  serviceDate: z.string(),
  advisorId: z.string(),
});

export const VisitSchema: z.ZodType<Visit> = z.object({
  id: z.string(),
  jobCardNo: z.string(),
  phone: z.string().nullable(),
  token: z.string(),
  createdBy: z.string(),
  createdAt: iso,
  expiresAt: iso,
  openedAt: isoOrNull,
  completedAt: isoOrNull,
  cancelledAt: isoOrNull,
  replacedBy: z.string().nullable(),
});

export const ResponseRecordSchema: z.ZodType<ResponseRecord> = z.object({
  id: z.string(),
  visitId: z.string(),
  questionsVersion: z.number().int(),
  submittedAt: iso,
  answers: AnswerMapSchema,
  deletedAt: isoOrNull,
});

const AlertReasonSchema: z.ZodType<AlertReason> = z.union([
  z.object({ kind: z.literal("callback") }),
  z.object({ kind: z.literal("low_rating"), code: z.enum(["Q1", "Q6", "Q11", "Q12"]) }),
]);

export const AlertSchema: z.ZodType<Alert> = z.object({
  id: z.string(),
  responseId: z.string(),
  reasons: z.array(AlertReasonSchema),
  status: z.enum(["open", "contacted", "resolved"]),
  notes: z.array(z.object({ at: iso, by: z.string(), text: z.string() })),
  createdAt: iso,
  updatedAt: iso,
});

const AuditActionSchema = z.enum([
  "link.create",
  "link.regenerate",
  "link.cancel",
  "response.edit",
  "response.delete",
  "response.restore",
  "alert.create",
  "alert.status",
  "alert.note",
  "user.create",
  "user.deactivate",
  "user.reactivate",
  "user.set_password",
  "auth.sign_in",
  "auth.lockout",
  "user.update",
  "user.reset_password",
  "user.change_password",
  "user.otp_reissue",
  "user.recover",
  "jobcard.create",
  "jobcard.update",
  "link.resend",
  "branch.create",
  "branch.update",
  "branch.deactivate",
  "branch.reactivate",
  "advisor.create",
  "advisor.update",
  "advisor.deactivate",
  "advisor.reactivate",
  "customer.export",
  "customer.erase",
  "response.purge",
  "system.cleanup",
]);

export const AuditEntrySchema: z.ZodType<AuditEntry> = z.object({
  id: z.string(),
  at: iso,
  actorId: z.string(),
  actorName: z.string(),
  action: AuditActionSchema,
  entityType: z.enum(["visit", "response", "alert", "user"]),
  entityId: z.string(),
  oldValue: z.unknown(),
  newValue: z.unknown(),
  note: z.string().exactOptional(),
});
