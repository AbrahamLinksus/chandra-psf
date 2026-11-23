import "server-only";
import type { z } from "zod";
import type { MethodKind } from "../ctx";

export type RpcAccess = "public" | "staff";

export interface RpcEntry {
  kind: MethodKind;
  access: RpcAccess;
  input: z.ZodType<unknown[]>;
}

/** One entry per repo method; `satisfies RpcTable<Repo>` makes a missing or misspelt method a type error. */
export type RpcTable<R> = { [M in keyof R]: RpcEntry };
