import "server-only";
import { z } from "zod";
import type { AnalyticsRepo } from "@/data/access";
import { filtersArg } from "./args";
import type { RpcTable } from "./types";

const analyticsFiltersArg = filtersArg.extend({ branchId: z.string().max(100).optional() });
const optionsArg = z.object({ branchId: z.string().max(100).optional() });
/** `getFilterOptions(undefined)` travels as `[null]` in JSON: treat null as "no options". */
const maybeOptions = optionsArg.nullable().transform((v) => v ?? undefined);

export const analyticsRpc = {
  getAnalytics: { kind: "read", access: "staff", input: z.tuple([analyticsFiltersArg]) },
  getFilterOptions: {
    kind: "read",
    access: "staff",
    input: z.union([z.tuple([maybeOptions]), z.tuple([])]),
  },
} satisfies RpcTable<AnalyticsRepo>;
