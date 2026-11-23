import "server-only";
import { z } from "zod";
import type { BranchRepo } from "@/data/access";
import { idArg, textArg } from "./args";
import type { RpcTable } from "./types";

export const branchesRpc = {
  listBranches: { kind: "read", access: "staff", input: z.tuple([]) },
  createBranch: {
    kind: "write",
    access: "staff",
    input: z.tuple([z.object({ name: textArg, city: textArg })]),
  },
  updateBranch: {
    kind: "write",
    access: "staff",
    input: z.tuple([idArg, z.object({ name: textArg.optional(), city: textArg.optional() })]),
  },
  setBranchActive: { kind: "write", access: "staff", input: z.tuple([idArg, z.boolean()]) },
} satisfies RpcTable<BranchRepo>;
