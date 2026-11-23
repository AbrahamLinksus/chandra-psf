import "server-only";
import { z } from "zod";
import type { AuthRepo } from "@/data/access";
import { textArg } from "./args";
import type { RpcTable } from "./types";

export const authRpc = {
  signIn: { kind: "write", access: "public", input: z.tuple([textArg, textArg]) },
  setOwnPassword: { kind: "write", access: "staff", input: z.tuple([textArg]) },
  changePassword: { kind: "write", access: "staff", input: z.tuple([textArg, textArg]) },
  signOut: { kind: "write", access: "public", input: z.tuple([]) },
  currentUser: { kind: "read", access: "public", input: z.tuple([]) },
} satisfies RpcTable<AuthRepo>;
