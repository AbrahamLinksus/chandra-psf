import "server-only";
import { z } from "zod";
import { AnswerMapSchema } from "@/domain/schemas";

const MAX_TEXT = 2000;

export const idArg = z.string().min(1).max(100);
export const textArg = z.string().max(MAX_TEXT);
export const answersArg = AnswerMapSchema;
export const stepUpArg = z.object({ password: z.string().max(MAX_TEXT) });

export const filtersArg = z.object({
  from: z.string().max(10),
  to: z.string().max(10),
  vehicleType: z.string().max(40).optional(),
  model: z.string().max(100).optional(),
  advisorId: z.string().max(100).optional(),
});
