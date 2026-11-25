import "server-only";
import { z } from "zod";
import type { ResponseRepo } from "@/data/access";
import { answersArg, filtersArg, idArg, stepUpArg } from "./args";
import type { RpcTable } from "./types";

const responseFiltersArg = filtersArg.extend({ branchId: z.string().max(100).optional() });
const versionArg = z.number().int().min(1);

export const responsesRpc = {
  listResponses: { kind: "read", access: "staff", input: z.tuple([responseFiltersArg]) },
  getResponse: { kind: "read", access: "staff", input: z.tuple([idArg]) },
  editResponse: {
    kind: "write",
    access: "staff",
    input: z.tuple([idArg, answersArg, versionArg, stepUpArg]),
  },
  deleteResponse: { kind: "write", access: "staff", input: z.tuple([idArg, stepUpArg]) },
  restoreResponse: { kind: "write", access: "staff", input: z.tuple([idArg, stepUpArg]) },
  listDeleted: { kind: "read", access: "staff", input: z.tuple([]) },
} satisfies RpcTable<ResponseRepo>;
