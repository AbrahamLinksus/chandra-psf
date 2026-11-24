import "server-only";
import { z } from "zod";
import type { FeedbackRepo } from "@/data/access";
import { answersArg, textArg } from "./args";
import type { RpcTable } from "./types";

export const feedbackRpc = {
  getVisitByToken: { kind: "read", access: "public", input: z.tuple([textArg]) },
  markOpened: { kind: "write", access: "public", input: z.tuple([textArg]) },
  submitResponse: {
    kind: "write",
    access: "public",
    input: z.union([z.tuple([textArg, answersArg]), z.tuple([textArg, answersArg, z.uuid()])]),
  },
} satisfies RpcTable<FeedbackRepo>;
