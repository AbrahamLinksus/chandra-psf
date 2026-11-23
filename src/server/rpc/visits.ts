import "server-only";
import { z } from "zod";
import type { VisitRepo } from "@/data/access";
import { idArg, textArg } from "./args";
import type { RpcTable } from "./types";

export const visitsRpc = {
  listMyVisits: {
    kind: "read",
    access: "staff",
    input: z.tuple([z.object({ search: textArg.optional() }).optional()]),
  },
  createVisitLink: {
    kind: "write",
    access: "staff",
    input: z.tuple([z.object({ jobCardNo: textArg, phone: textArg.nullable() })]),
  },
  regenerateLink: { kind: "write", access: "staff", input: z.tuple([idArg]) },
  cancelLink: { kind: "write", access: "staff", input: z.tuple([idArg]) },
} satisfies RpcTable<VisitRepo>;
