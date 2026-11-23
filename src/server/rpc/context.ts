import "server-only";
import { cookies } from "next/headers";
import { createNextSessionCookies } from "../auth/cookies";
import { readSession, touchSession } from "../auth/session";
import type { MethodKind, RequestCtx } from "../ctx";
import { getDb } from "../db/client";
import { getServerEnv } from "../env";
import { log } from "../log";
import { scopeOf } from "../scope";

export const ACTIVE_HEADER = "x-psf-active";

export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip") || "unknown";
}

/** Request context before the session is read (enough for the flood limit). */
export async function buildBaseCtx(request: Request): Promise<RequestCtx> {
  const production = getServerEnv().VERCEL_ENV === "production";
  return {
    db: await getDb(),
    clock: { now: () => new Date() },
    session: null,
    scope: null,
    ip: clientIp(request.headers),
    cookies: createNextSessionCookies(await cookies(), production),
    log,
  };
}

/** Reads the session (LLD §18.2); touches it for a write or when the tab is active. */
export async function withSession(
  base: RequestCtx,
  request: Request,
  kind: MethodKind,
): Promise<RequestCtx> {
  const session = await readSession(base);
  if (!session) return base;
  if (kind === "write" || request.headers.get(ACTIVE_HEADER) === "1") {
    await touchSession(base, session);
  }
  return { ...base, session, scope: scopeOf(session.user) };
}
