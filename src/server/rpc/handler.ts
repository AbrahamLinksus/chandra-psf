import "server-only";
import { err, type Result } from "@/data/access/result";
import { guard, type RequestCtx } from "../ctx";
import { log } from "../log";
import { hitIpLimit, PUBLIC_FLOOD_BUCKET, PUBLIC_FLOOD_LIMIT_PER_HOUR } from "../rateLimit";
import { createServerDataAccess } from "../createServerDataAccess";
import { buildBaseCtx, withSession } from "./context";
import { findRpcEntry } from "./index";
import type { RpcEntry } from "./types";

export interface RpcParams {
  repo: string;
  method: string;
}

const HEADERS = { "Cache-Control": "no-store" };

function reply(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: HEADERS });
}

function plain(status: number, message: string): Response {
  return reply(
    { ok: false, error: { code: status === 404 ? "NOT_FOUND" : "FORBIDDEN", message } },
    status,
  );
}

/** CSRF gate: same-origin Origin header and a JSON body. */
function sameOriginJson(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    if (new URL(origin).host !== host) return false;
  } catch {
    return false;
  }
  return (request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json");
}

async function parseArgs(entry: RpcEntry, request: Request): Promise<unknown[] | null> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return null;
  }
  const args = typeof body === "object" && body !== null ? (body as { args?: unknown }).args : [];
  const parsed = entry.input.safeParse(args ?? []);
  return parsed.success ? parsed.data : null;
}

type Dispatch = (...args: unknown[]) => Promise<unknown>;

async function dispatch(ctx: RequestCtx, p: RpcParams, args: unknown[]): Promise<Result<unknown>> {
  const repo = (createServerDataAccess(ctx) as unknown as Record<string, Record<string, Dispatch>>)[
    p.repo
  ];
  const fn = repo?.[p.method];
  if (!fn) return err("UNAVAILABLE", "Not available yet.");
  return (await fn.apply(repo, args)) as Result<unknown>;
}

async function run(
  entry: RpcEntry,
  p: RpcParams,
  request: Request,
  args: unknown[],
): Promise<Response> {
  const base = await buildBaseCtx(request);
  if (entry.access === "public") {
    const allowed = await hitIpLimit(base, {
      bucket: PUBLIC_FLOOD_BUCKET,
      limit: PUBLIC_FLOOD_LIMIT_PER_HOUR,
    });
    if (!allowed) {
      return reply({
        ok: false,
        error: { code: "RATE_LIMITED", message: "Too many requests. Try again later." },
      });
    }
  }
  const ctx = await withSession(base, request, entry.kind);
  if (entry.access === "staff" && !ctx.session) {
    return reply(err("UNAUTHENTICATED", "Your session has ended. Sign in again."));
  }
  return reply(await dispatch(ctx, p, args));
}

/** The only data door (LLD §17.3). Always HTTP 200 with a `Result`, except 403 and 404. */
export async function handleRpc(request: Request, p: RpcParams): Promise<Response> {
  if (!sameOriginJson(request)) return plain(403, "Forbidden.");
  const entry = findRpcEntry(p.repo, p.method);
  if (!entry) return plain(404, "Not found.");
  const args = await parseArgs(entry, request);
  if (!args) return reply(err("VALIDATION", "Check the details and try again."));
  const out = await guard({ log }, "rpc.run", entry.kind, async () => ({
    ok: true as const,
    value: await run(entry, p, request, args),
  }));
  return out.ok ? out.value : reply(out);
}
