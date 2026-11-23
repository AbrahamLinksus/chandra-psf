import "server-only";
import { z } from "zod";
import type { AdvisorRepo } from "@/data/access";
import { idArg, textArg } from "./args";
import type { RpcTable } from "./types";

export const advisorsRpc = {
  listAdvisors: {
    kind: "read",
    access: "staff",
    input: z.tuple([z.object({ branchId: idArg.optional(), activeOnly: z.boolean().optional() })]),
  },
  createAdvisor: {
    kind: "write",
    access: "staff",
    input: z.tuple([z.object({ branchId: idArg, name: textArg })]),
  },
  renameAdvisor: { kind: "write", access: "staff", input: z.tuple([idArg, textArg]) },
  setAdvisorActive: { kind: "write", access: "staff", input: z.tuple([idArg, z.boolean()]) },
} satisfies RpcTable<AdvisorRepo>;
