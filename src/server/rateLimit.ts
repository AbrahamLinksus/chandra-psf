import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import type { RequestCtx } from "./ctx";
import { getPublicFloodLimitOverride, getServerEnv } from "./env";
import { rateLimits } from "./db/schema";

export const PUBLIC_FLOOD_LIMIT_PER_HOUR = 300;
export const PUBLIC_FLOOD_BUCKET = "rpc_public";
const HOUR_MS = 3_600_000;

/**
 * Public flood limit: the E2E-only PUBLIC_FLOOD_LIMIT_OVERRIDE (see getPublicFloodLimitOverride in env.ts)
 * when honoured, else the fallback. It is ignored when VERCEL_ENV=production and when NODE_ENV=production
 * on a non-`pglite:` DATABASE_URL, so a real deploy always keeps 300. If the override cannot be read
 * at all (e.g. an env module stub without it), the fallback applies: fail safe, never fail the call.
 */
function publicFloodLimit(fallback: number): number {
  try {
    return getPublicFloodLimitOverride() ?? fallback;
  } catch {
    return fallback;
  }
}

/** Without IP_HASH_PEPPER (dev, tests) a per-process random pepper is used: no secret lives in the source. */
const processPepper = randomBytes(32).toString("base64");

/** The IP is stored only as this HMAC, never in clear. */
export function hashIp(ip: string): Buffer {
  const pepper = getServerEnv().IP_HASH_PEPPER ?? processPepper;
  return createHmac("sha256", pepper).update(ip).digest();
}

export interface LimitSpec {
  bucket: string;
  limit: number;
  windowMs?: number;
}

/** Fixed-window counter per (bucket, HMAC of ip). Counts this hit; true while the count is within `limit`. */
export async function hitIpLimit(
  ctx: Pick<RequestCtx, "db" | "clock" | "ip">,
  spec: LimitSpec,
): Promise<boolean> {
  const windowMs = spec.windowMs ?? HOUR_MS;
  const now = ctx.clock.now().getTime();
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
  const [row] = await ctx.db
    .insert(rateLimits)
    .values({ bucket: spec.bucket, key: hashIp(ctx.ip), windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimits.bucket, rateLimits.key, rateLimits.windowStart],
      set: { count: sql`${rateLimits.count} + 1` },
    })
    .returning({ count: rateLimits.count });
  const limit = spec.bucket === PUBLIC_FLOOD_BUCKET ? publicFloodLimit(spec.limit) : spec.limit;
  return (row?.count ?? 1) <= limit;
}
