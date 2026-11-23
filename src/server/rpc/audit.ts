import "server-only";
import { z } from "zod";
import type { AuditRepo } from "@/data/access";
import type { RpcTable } from "./types";

export const auditRpc = {
  listAudit: {
    kind: "read",
    access: "staff",
    input: z.tuple([z.object({ action: z.string().max(64).optional() }).optional()]),
  },
} satisfies RpcTable<AuditRepo>;
