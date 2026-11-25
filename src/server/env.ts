// No "server-only" import: scripts/migrate.ts and scripts/admin.ts run under tsx and import this file.
// It reads only non-public variables, so it adds no secret to a client bundle.
import { z } from "zod";

const PGLITE_PREFIX = "pglite:";
const MIN_SECRET_LENGTH = 32;

const secret = z
  .string()
  .min(MIN_SECRET_LENGTH, `must be at least ${String(MIN_SECRET_LENGTH)} characters`);

const ServerEnvSchema = z
  .object({
    DATABASE_URL: z.string().min(1),
    DATABASE_URL_UNPOOLED: z.string().optional(),
    CRON_SECRET: z.string().optional(),
    IP_HASH_PEPPER: z.string().optional(),
    APP_URL: z.url().optional(),
    VERCEL_ENV: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.VERCEL_ENV !== "production") return;
    const issue = (path: string, message: string): void => {
      ctx.addIssue({ code: "custom", path: [path], message });
    };
    if (env.DATABASE_URL.startsWith(PGLITE_PREFIX)) {
      issue("DATABASE_URL", "pglite: is not allowed in production");
    }
    if (!env.DATABASE_URL_UNPOOLED) issue("DATABASE_URL_UNPOOLED", "required in production");
    if (!secret.safeParse(env.CRON_SECRET).success) {
      issue("CRON_SECRET", `required in production, ${String(MIN_SECRET_LENGTH)}+ characters`);
    }
    if (!secret.safeParse(env.IP_HASH_PEPPER).success) {
      issue("IP_HASH_PEPPER", `required in production, ${String(MIN_SECRET_LENGTH)}+ characters`);
    }
    if (!env.APP_URL) issue("APP_URL", "required in production");
    else if (!env.APP_URL.startsWith("https://")) issue("APP_URL", "must be https in production");
  });

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

export function isPgliteUrl(url: string): boolean {
  return url.startsWith(PGLITE_PREFIX);
}

/** Parses a source (tests pass their own). Server keys have no fallback except DATABASE_URL -> pglite:memory under NODE_ENV=test. */
export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const databaseUrl =
    source["DATABASE_URL"] || (source["NODE_ENV"] === "test" ? "pglite:memory" : undefined);
  return ServerEnvSchema.parse({
    DATABASE_URL: databaseUrl,
    DATABASE_URL_UNPOOLED: source["DATABASE_URL_UNPOOLED"] || undefined,
    CRON_SECRET: source["CRON_SECRET"] || undefined,
    IP_HASH_PEPPER: source["IP_HASH_PEPPER"] || undefined,
    APP_URL: source["APP_URL"] || undefined,
    VERCEL_ENV: source["VERCEL_ENV"] || undefined,
  });
}

let cached: ServerEnv | undefined;

/** Lazy so importing this module never throws; the first caller validates process.env. */
export function getServerEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}

/** Opt-in hash timing log flag (AUTH_HASH_TIMING=1); read live on every call, deliberately not cached or in the schema. */
export function isHashTimingEnabled(): boolean {
  return process.env["AUTH_HASH_TIMING"] === "1";
}

/**
 * E2E-only override of the public flood limit (PUBLIC_FLOOD_LIMIT_OVERRIDE); read live, not cached or in the schema.
 * Returns undefined (use the default) when unset or not a positive integer, when VERCEL_ENV=production,
 * or when NODE_ENV=production on a non-pglite database.
 */
export function getPublicFloodLimitOverride(): number | undefined {
  const override = Number(process.env["PUBLIC_FLOOD_LIMIT_OVERRIDE"]);
  if (!Number.isInteger(override) || override <= 0) return undefined;
  if (process.env["VERCEL_ENV"] === "production") return undefined;
  const e2eServer = isPgliteUrl(process.env["DATABASE_URL"] ?? "");
  return process.env["NODE_ENV"] !== "production" || e2eServer ? override : undefined;
}
