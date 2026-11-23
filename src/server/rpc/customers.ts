import "server-only";
import { z } from "zod";
import type { CustomerRepo } from "@/data/access";
import { idArg, stepUpArg, textArg } from "./args";
import type { RpcTable } from "./types";

const ids = z.array(idArg).max(500);

export const customersRpc = {
  searchCustomers: {
    kind: "read",
    access: "staff",
    input: z.tuple([z.object({ phone: textArg.optional(), regNo: textArg.optional() })]),
  },
  exportCustomers: { kind: "read", access: "staff", input: z.tuple([ids]) },
  eraseCustomers: { kind: "write", access: "staff", input: z.tuple([ids, stepUpArg]) },
} satisfies RpcTable<CustomerRepo>;
