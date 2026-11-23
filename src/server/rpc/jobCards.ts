import "server-only";
import { z } from "zod";
import type { JobCardRepo } from "@/data/access";
import { textArg } from "./args";
import type { RpcTable } from "./types";

export const jobCardsRpc = {
  getJobCard: { kind: "read", access: "staff", input: z.tuple([textArg]) },
  listFreshJobCards: { kind: "read", access: "staff", input: z.tuple([]) },
} satisfies RpcTable<JobCardRepo>;
