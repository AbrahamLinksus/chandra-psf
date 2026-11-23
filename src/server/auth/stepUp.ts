import "server-only";
import { and, count, eq, gte, sql } from "drizzle-orm";
import { err, ok, type Result, type StepUp } from "@/data/access/result";
import type { RequestCtx } from "../ctx";
import { loginAttempts, users } from "../db/schema";
import { hashIp } from "../rateLimit";
import { requireStaff } from "../scope";
import { verifyPassword } from "./password";
import { endUserSessions } from "./session";

export const STEP_UP_WINDOW_MS = 15 * 60_000;
export const STEP_UP_FAILURE_LIMIT = 5;
const BAD_PASSWORD = "Password incorrect";
const SIGNED_OUT = "Too many wrong passwords. Sign in again.";

type Reserved = { id: number; fifth: boolean };

/**
 * Reserves a guess before the password is checked, serialised per user so parallel requests can't
 * pass the cap. Null when the user is already at 5 in 15 minutes; otherwise the attempt row's id and
 * whether it is the 5th.
 */
async function reserve(
  ctx: RequestCtx,
  userId: string,
  emailKey: string,
): Promise<Reserved | null> {
  const now = ctx.clock.now();
  const since = new Date(now.getTime() - STEP_UP_WINDOW_MS);
  return ctx.db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`stepup:${userId}`}))`);
    const [counted] = await tx
      .select({ n: count() })
      .from(loginAttempts)
      .where(
        and(
          eq(loginAttempts.kind, "stepup"),
          eq(loginAttempts.userId, userId),
          gte(loginAttempts.at, since),
        ),
      );
    const n = counted?.n ?? 0;
    if (n >= STEP_UP_FAILURE_LIMIT) return null;
    const [row] = await tx
      .insert(loginAttempts)
      .values({ emailKey, ipHash: hashIp(ctx.ip), at: now, kind: "stepup", userId })
      .returning({ id: loginAttempts.id });
    return { id: row?.id ?? 0, fifth: n === STEP_UP_FAILURE_LIMIT - 1 };
  });
}

/** The 5th wrong step-up: end every session of the user and forget their step-up failures. */
async function signOutEverywhere(ctx: RequestCtx, userId: string): Promise<void> {
  await ctx.db.transaction(async (tx) => {
    await endUserSessions(tx, userId);
    await tx
      .delete(loginAttempts)
      .where(and(eq(loginAttempts.kind, "stepup"), eq(loginAttempts.userId, userId)));
  });
}

/**
 * Re-checks the signed-in user's password before a sensitive action (LLD §18.4).
 * Wrong: BAD_PASSWORD "Password incorrect"; the 5th wrong in 15 minutes ends the user's sessions (UNAUTHENTICATED).
 */
export async function verifyStepUp(ctx: RequestCtx, s: StepUp): Promise<Result<void>> {
  const staff = requireStaff(ctx);
  if (!staff.ok) return staff;
  const { user } = staff.value;
  const [row] = await ctx.db
    .select({ hash: users.passwordHash })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  if (!row) return err("UNAUTHENTICATED", "Sign in to continue.");
  const reserved = await reserve(ctx, user.id, user.email.trim().toLowerCase());
  if (reserved && (await verifyPassword(row.hash, s.password))) {
    await ctx.db.delete(loginAttempts).where(eq(loginAttempts.id, reserved.id));
    return ok(undefined);
  }
  if (reserved && !reserved.fifth) return err("BAD_PASSWORD", BAD_PASSWORD);
  if (reserved) await signOutEverywhere(ctx, user.id);
  ctx.cookies.clear();
  return err("UNAUTHENTICATED", SIGNED_OUT);
}
