import "server-only";
import { z } from "zod";
import type { AlertRepo } from "@/data/access";
import { idArg, textArg } from "./args";
import type { RpcTable } from "./types";

const status = z.enum(["open", "contacted", "resolved"]);

export const alertsRpc = {
  listAlerts: {
    kind: "read",
    access: "staff",
    input: z.tuple([
      z.object({ status: status.optional(), branchId: idArg.optional() }).optional(),
    ]),
  },
  countOpen: { kind: "read", access: "staff", input: z.tuple([]) },
  updateAlert: {
    kind: "write",
    access: "staff",
    input: z.tuple([
      idArg,
      z.object({ status: status.optional(), note: textArg.optional() }),
      z.number().int().min(1),
    ]),
  },
} satisfies RpcTable<AlertRepo>;
