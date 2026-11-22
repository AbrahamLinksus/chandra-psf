import { z } from "zod";
import {
  CUSTOMER_NAME_MAX,
  JOB_CARD_NO_MAX,
  JOB_CARD_NO_MIN,
  REG_NO_MAX,
  REG_NO_MIN,
  SERVICE_DATE_MAX_AGE_DAYS,
} from "./constants";
import { HONDA_MODELS, OTHER_MODEL, SERVICE_TYPES, type VehicleType } from "./models";
import { toWhatsAppNumber } from "./phone";
import { addDays, istDateOf } from "./time";

const JOB_CARD_NO_CHARS = /^[A-Za-z0-9 -]+$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const REG_NO_PARTS = /^([A-Z]{2})(\d{1,2})([A-Z]{1,3})(\d{4})$/;

export const FUTURE_DATE_MESSAGE = "Service date can't be in the future";
export const OLD_DATE_MESSAGE = `Service date can't be more than ${String(SERVICE_DATE_MAX_AGE_DAYS)} days ago`;

/** Registration number for display: `tn09bx4521` becomes `TN 09 BX 4521`. Unknown shapes stay upper-case. */
export function formatRegNo(raw: string): string {
  const key = raw.replace(/[\s-]+/g, "").toUpperCase();
  const m = REG_NO_PARTS.exec(key);
  return m === null ? key : m.slice(1).join(" ");
}

/** `+91 98400 12345` for a valid Indian mobile, else null. */
export function formatMobile(raw: string): string | null {
  const wa = toWhatsAppNumber(raw);
  if (wa === null) return null;
  const national = wa.slice(2);
  return `+91 ${national.slice(0, 5)} ${national.slice(5)}`;
}

const jobCardNo = z
  .string()
  .trim()
  .min(JOB_CARD_NO_MIN, "Job card number is too short")
  .max(JOB_CARD_NO_MAX, "Job card number is too long")
  .regex(JOB_CARD_NO_CHARS, "Use letters, digits, spaces or dashes only");

const phone = z
  .string()
  .nullish()
  .transform((v, ctx): string | null => {
    if (v === null || v === undefined || v.trim() === "") return null;
    const formatted = formatMobile(v);
    if (formatted === null) {
      ctx.addIssue({ code: "custom", message: "Enter a valid Indian mobile number" });
      return z.NEVER;
    }
    return formatted;
  });

const regNo = z.string().transform((v, ctx): string => {
  const len = v.replace(/[\s-]+/g, "").length;
  if (len < REG_NO_MIN || len > REG_NO_MAX || !/^[A-Za-z0-9 -]+$/.test(v)) {
    ctx.addIssue({ code: "custom", message: "Enter a valid registration number" });
    return z.NEVER;
  }
  return formatRegNo(v);
});

const rawFields = {
  jobCardNo,
  customerName: z
    .string()
    .trim()
    .min(1, "Customer name is required")
    .max(CUSTOMER_NAME_MAX, "Customer name is too long"),
  phone,
  regNo,
  model: z.string().refine((m) => Object.hasOwn(HONDA_MODELS, m), "Pick a model"),
  modelOther: z.string().trim().max(CUSTOMER_NAME_MAX).optional(),
  vehicleType: z.enum(["scooter", "motorcycle"]).optional(),
  serviceType: z.enum(SERVICE_TYPES),
  serviceDate: z
    .string()
    .regex(ISO_DATE, "Enter a valid service date")
    .refine((d) => !Number.isNaN(Date.parse(d)), "Enter a valid service date"),
  advisorId: z.string().min(1, "Pick an advisor"),
};

interface RawInput {
  model: string;
  modelOther?: string | undefined;
  vehicleType?: VehicleType | undefined;
  serviceDate: string;
}

function checkModel(v: RawInput, ctx: z.RefinementCtx): void {
  if (v.model !== OTHER_MODEL) return;
  if (v.modelOther === undefined || v.modelOther === "") {
    ctx.addIssue({ code: "custom", path: ["modelOther"], message: "Enter the model name" });
  }
  if (v.vehicleType === undefined) {
    ctx.addIssue({ code: "custom", path: ["vehicleType"], message: "Pick a vehicle type" });
  }
}

function checkServiceDate(v: RawInput, now: Date, ctx: z.RefinementCtx): void {
  const today = istDateOf(now);
  if (v.serviceDate > today) {
    ctx.addIssue({ code: "custom", path: ["serviceDate"], message: FUTURE_DATE_MESSAGE });
  } else if (v.serviceDate < addDays(today, -SERVICE_DATE_MAX_AGE_DAYS)) {
    ctx.addIssue({ code: "custom", path: ["serviceDate"], message: OLD_DATE_MESSAGE });
  }
}

/** SPEC F-2 field rules. Output is normalised: spaced reg. no, `+91 …` phone, vehicle type resolved from the model. */
export function jobCardInputSchema(now: Date) {
  return z
    .object(rawFields)
    .superRefine((v, ctx) => {
      checkModel(v, ctx);
      checkServiceDate(v, now, ctx);
    })
    .transform((v) => ({ ...v, vehicleType: HONDA_MODELS[v.model] ?? v.vehicleType }));
}

export type JobCardInputParsed = z.output<ReturnType<typeof jobCardInputSchema>>;
