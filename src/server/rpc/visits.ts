import "server-only";
import { z } from "zod";
import type { VisitRepo } from "@/data/access";
import { idArg, textArg } from "./args";
import type { RpcTable } from "./types";

export const visitsRpc = {
  listVisits: {
    kind: "read",
    access: "staff",
    input: z.tuple([z.object({ scope: z.enum(["mine", "branch"]), search: textArg.optional() })]),
  },
  createVisitLink: {
    kind: "write",
    access: "staff",
    input: z.tuple([z.object({ jobCardId: idArg })]),
  },
  resendLink: { kind: "write", access: "staff", input: z.tuple([idArg]) },
  regenerateLink: { kind: "write", access: "staff", input: z.tuple([idArg]) },
  cancelLink: { kind: "write", access: "staff", input: z.tuple([idArg]) },
} satisfies RpcTable<VisitRepo>;
