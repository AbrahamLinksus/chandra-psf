import type { DataAccess, Topic } from "@/data/access";
import { rpc, type RpcDeps } from "./rpcClient";

export interface RemoteDeps extends Omit<RpcDeps, "isActive"> {
  activity: { isActive(): boolean };
  poller: { subscribe(listener: (topics: Topic[]) => void): () => void };
}

/** Every method call on a repo becomes `POST /api/rpc/<repo>/<method>`. */
function repoProxy(repo: string, deps: RpcDeps): object {
  return new Proxy({}, {
    get(_target, method) {
      if (typeof method !== "string" || method === "then") return undefined;
      return (...args: unknown[]) => rpc(deps, repo, method, args);
    },
  });
}

export function createRemoteDataAccess(deps: RemoteDeps): DataAccess {
  const rpcDeps: RpcDeps = {
    fetch: deps.fetch,
    isActive: () => deps.activity.isActive(),
    onUnauthenticated: deps.onUnauthenticated,
  };
  const repo = <K extends Exclude<keyof DataAccess, "subscribe">>(name: K): DataAccess[K] =>
    repoProxy(name, rpcDeps) as DataAccess[K];
  return {
    auth: repo("auth"),
    jobCards: repo("jobCards"),
    visits: repo("visits"),
    feedback: repo("feedback"),
    analytics: repo("analytics"),
    alerts: repo("alerts"),
    responses: repo("responses"),
    audit: repo("audit"),
    users: repo("users"),
    branches: repo("branches"),
    advisors: repo("advisors"),
    customers: repo("customers"),
    subscribe: (listener) => deps.poller.subscribe(listener),
  };
}
