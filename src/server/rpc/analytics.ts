import "server-only";
import { z } from "zod";
import type { AnalyticsRepo } from "@/data/access";
import { filtersArg } from "./args";
import type { RpcTable } from "./types";

export const analyticsRpc = {
  getAnalytics: { kind: "read", access: "staff", input: z.tuple([filtersArg]) },
  getFilterOptions: { kind: "read", access: "staff", input: z.tuple([]) },
} satisfies RpcTable<AnalyticsRepo>;
