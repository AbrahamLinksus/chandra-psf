import { z } from "zod";
import type {
  Advisor,
  Alert,
  AlertReason,
  AnswerMap,
  AnswerValue,
  AuditEntry,
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
  role: z.enum(["admin", "support"]),
  active: z.boolean(),
  mustSetPassword: z.boolean(),
  createdAt: iso,
});
export const StoredUserSchema = UserSchema.and(z.object({ passwordHash: z.string() }));
export const AdvisorSchema: z.ZodType<Advisor> = z.object({ id: z.string(), name: z.string() });

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

export const MetaSchema = z.object({ schemaVersion: z.literal(1), seededAt: iso });

/** Storage schema of every Db collection (LLD 3.1); `read(k)` validates with `DbSchemas[k]`. */
export const DbSchemas = {
  meta: MetaSchema,
  users: z.array(StoredUserSchema),
  advisors: z.array(AdvisorSchema),
  jobCards: z.array(JobCardSchema),
  visits: z.array(VisitSchema),
  responses: z.array(ResponseRecordSchema),
  alerts: z.array(AlertSchema),
  audit: z.array(AuditEntrySchema),
} as const;

export const SessionSchema = z.object({ userId: z.string() });

// ---- Seed fixture (LLD 4): same as Db, timestamps are day offsets from the load day (IST) ----
export const SeedTimeSchema = z.object({
  dayOffset: z.number().int(),
  minute: z.number().int().min(0).max(1439),
});
export type SeedTime = z.infer<typeof SeedTimeSchema>;
const seedTime = SeedTimeSchema;
const seedTimeOrNull = SeedTimeSchema.nullable();

export const SeedSchema = z.object({
  users: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      role: z.enum(["admin", "support"]),
      active: z.boolean(),
      mustSetPassword: z.boolean(),
      createdAt: seedTime,
    }),
  ),
  advisors: z.array(AdvisorSchema),
  jobCards: z.array(
    z.object({
      jobCardNo: z.string(),
      customerName: z.string(),
      phone: z.string().nullable(),
      regNo: z.string(),
      model: z.string(),
      vehicleType: z.enum(["scooter", "motorcycle"]),
      serviceType: z.string(),
      serviceDate: seedTime,
      advisorId: z.string(),
    }),
  ),
  visits: z.array(
    z.object({
      id: z.string(),
      jobCardNo: z.string(),
      phone: z.string().nullable(),
      createdBy: z.string(),
      createdAt: seedTime,
      expiresAt: seedTime,
      openedAt: seedTimeOrNull,
      completedAt: seedTimeOrNull,
      cancelledAt: seedTimeOrNull,
      replacedBy: z.string().nullable(),
    }),
  ),
  responses: z.array(
    z.object({
      id: z.string(),
      visitId: z.string(),
      questionsVersion: z.number().int(),
      submittedAt: seedTime,
      answers: AnswerMapSchema,
      deletedAt: seedTimeOrNull,
    }),
  ),
  alerts: z.array(
    z.object({
      id: z.string(),
      responseId: z.string(),
      reasons: z.array(AlertReasonSchema),
      status: z.enum(["open", "contacted", "resolved"]),
      notes: z.array(z.object({ at: seedTime, by: z.string(), text: z.string() })),
      createdAt: seedTime,
      updatedAt: seedTime,
    }),
  ),
  audit: z.array(
    z.object({
      id: z.string(),
      at: seedTime,
      actorId: z.string(),
      actorName: z.string(),
      action: AuditActionSchema,
      entityType: z.enum(["visit", "response", "alert", "user"]),
      entityId: z.string(),
      oldValue: z.unknown(),
      newValue: z.unknown(),
      note: z.string().exactOptional(),
    }),
  ),
});
export type Seed = z.infer<typeof SeedSchema>;
