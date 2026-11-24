import "server-only";
import { z } from "zod";
import type { JobCardRepo } from "@/data/access";
import { idArg, textArg } from "./args";
import type { RpcTable } from "./types";

const fields = {
  jobCardNo: textArg,
  customerName: textArg,
  phone: textArg.nullable(),
  regNo: textArg,
  model: textArg,
  modelOther: textArg.optional(),
  vehicleType: z.enum(["scooter", "motorcycle"]).optional(),
  serviceType: textArg,
  serviceDate: textArg,
  advisorId: idArg,
};

export const jobCardsRpc = {
  getJobCard: { kind: "read", access: "staff", input: z.tuple([textArg]) },
  createJobCard: {
    kind: "write",
    access: "staff",
    input: z.tuple([z.object({ ...fields, requestId: z.uuid() })]),
  },
  updateJobCard: {
    kind: "write",
    access: "staff",
    input: z.tuple([idArg, z.object(fields).partial()]),
  },
  listFreshJobCards: { kind: "read", access: "staff", input: z.tuple([]) },
} satisfies RpcTable<JobCardRepo>;
