import "server-only";
import { z } from "zod";
import type { AuditRepo } from "@/data/access";
import { idArg } from "./args";
import type { RpcTable } from "./types";

export const auditRpc = {
  listAudit: {
    kind: "read",
    access: "staff",
    input: z.tuple([
      z
        .object({
          action: z.string().max(64).optional(),
          branchId: idArg.optional(),
          before: z
            .string()
            .regex(/^\d{1,15}$/)
            .optional(),
        })
        .optional(),
    ]),
  },
} satisfies RpcTable<AuditRepo>;
