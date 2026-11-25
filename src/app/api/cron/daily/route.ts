import { createHash, timingSafeEqual } from "node:crypto";
import { getDb } from "@/server/db/client";
import { getServerEnv } from "@/server/env";
import { runDailyCleanup } from "@/server/jobs/cleanup";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const digest = (value: string): Buffer => createHash("sha256").update(value).digest();

/** Constant-time check of `Authorization: Bearer <CRON_SECRET>`; no secret configured means nobody is let in. */
function isAuthorised(request: Request): boolean {
  const secret = getServerEnv().CRON_SECRET;
  if (!secret) return false;
  const given = request.headers.get("authorization") ?? "";
  return timingSafeEqual(digest(given), digest(`Bearer ${secret}`));
}

export async function GET(request: Request): Promise<Response> {
  if (!isAuthorised(request)) return new Response("Unauthorized", { status: 401 });
  const db = await getDb();
  const counts = await runDailyCleanup(db, { now: () => new Date() });
  return Response.json(counts);
}
