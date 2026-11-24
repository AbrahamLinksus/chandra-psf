import "server-only";
import { z } from "zod";
import type { UserRepo } from "@/data/access";
import { idArg, textArg } from "./args";
import type { RpcTable } from "./types";

const roleArg = z.enum(["support", "branch_admin", "main_admin"]);
const branchArg = idArg.nullable();

export const usersRpc = {
  listUsers: {
    kind: "read",
    access: "staff",
    input: z.tuple([z.object({ branchId: idArg.optional() }).optional()]),
  },
  createUser: {
    kind: "write",
    access: "staff",
    input: z.tuple([
      z.object({
        name: textArg,
        email: textArg,
        role: roleArg,
        branchId: branchArg,
        tempPassword: textArg,
      }),
    ]),
  },
  updateUser: {
    kind: "write",
    access: "staff",
    input: z.tuple([
      idArg,
      z.object({
        name: textArg.optional(),
        email: textArg.optional(),
        role: roleArg.optional(),
        branchId: branchArg.optional(),
      }),
    ]),
  },
  setUserActive: { kind: "write", access: "staff", input: z.tuple([idArg, z.boolean()]) },
  resetPassword: { kind: "write", access: "staff", input: z.tuple([idArg, textArg]) },
} satisfies RpcTable<UserRepo>;
