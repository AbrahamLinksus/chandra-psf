import { err, type Result } from "@/data/access/result";

export type MethodKind = "read" | "write";

export interface RpcDeps {
  fetch: typeof fetch;
  /** True while the tab is visible and the user is active; sent as `x-psf-active` (LLD §20). */
  isActive: () => boolean;
  /** Called once per reply that says the session ended (the app invalidates its session query). */
  onUnauthenticated: () => void;
}

/** Reads start with get/list/count/current; everything else changes data. */
export function kindOf(method: string): MethodKind {
  return /^(get|list|count|current)/.test(method) ? "read" : "write";
}

function networkFailure(kind: MethodKind): Result<never> {
  return kind === "write"
    ? err("SAVE_FAILED", "Couldn't save, try again.")
    : err("UNAVAILABLE", "Couldn't load, try again.");
}

function isResult(value: unknown): value is Result<unknown> {
  if (typeof value !== "object" || value === null) return false;
  const ok = (value as { ok?: unknown }).ok;
  return ok === true || ok === false;
}

/** POST /api/rpc/<repo>/<method>. Never throws: a network or parse failure is a `Result`. */
export async function rpc(
  deps: RpcDeps,
  repo: string,
  method: string,
  args: unknown[],
): Promise<Result<unknown>> {
  const kind = kindOf(method);
  try {
    const res = await deps.fetch(`/api/rpc/${repo}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-psf-active": deps.isActive() ? "1" : "0" },
      body: JSON.stringify({ args }),
      credentials: "same-origin",
    });
    const body: unknown = await res.json();
    if (!isResult(body)) return networkFailure(kind);
    if (!body.ok && body.error.code === "UNAUTHENTICATED") deps.onUnauthenticated();
    return body;
  } catch {
    return networkFailure(kind);
  }
}
