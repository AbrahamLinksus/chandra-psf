import "server-only";
import { alertsRpc } from "./alerts";
import { analyticsRpc } from "./analytics";
import { auditRpc } from "./audit";
import { authRpc } from "./auth";
import { feedbackRpc } from "./feedback";
import { jobCardsRpc } from "./jobCards";
import { responsesRpc } from "./responses";
import type { RpcEntry } from "./types";
import { usersRpc } from "./users";
import { visitsRpc } from "./visits";

/** Repo name -> method table. Listed per repo so a slice adds one line here and one file beside it. */
export const rpcTables: Readonly<Record<string, Readonly<Record<string, RpcEntry>>>> = {
  auth: authRpc,
  jobCards: jobCardsRpc,
  visits: visitsRpc,
  feedback: feedbackRpc,
  analytics: analyticsRpc,
  alerts: alertsRpc,
  responses: responsesRpc,
  audit: auditRpc,
  users: usersRpc,
};

export function findRpcEntry(repo: string, method: string): RpcEntry | undefined {
  const table = Object.hasOwn(rpcTables, repo) ? rpcTables[repo] : undefined;
  return table && Object.hasOwn(table, method) ? table[method] : undefined;
}
