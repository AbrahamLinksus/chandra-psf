import "server-only";
import { z } from "zod";
import type { UserRepo } from "@/data/access";
import { idArg, textArg } from "./args";
import type { RpcTable } from "./types";

export const usersRpc = {
  listUsers: { kind: "read", access: "staff", input: z.tuple([]) },
  createSupportUser: {
    kind: "write",
    access: "staff",
    input: z.tuple([z.object({ name: textArg, email: textArg, tempPassword: textArg })]),
  },
  setUserActive: { kind: "write", access: "staff", input: z.tuple([idArg, z.boolean()]) },
} satisfies RpcTable<UserRepo>;
