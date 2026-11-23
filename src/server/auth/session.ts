import { createHash, randomBytes } from "node:crypto";
import { and, eq, lte, ne } from "drizzle-orm";
import { ADMIN_IDLE_HOURS, SESSION_MAX_DAYS, SUPPORT_IDLE_HOURS } from "@/domain/constants";
import { isAdmin, type StaffRole } from "@/domain/roles";
import type { Db, Tx } from "../db/client";
import { branches, sessions, users } from "../db/schema";
import type { RequestCtx, SessionInfo } from "../ctx";

const TOKEN_BYTES = 32;
export const TOUCH_INTERVAL_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

export function hashToken(token: string): Buffer {
  return createHash("sha256").update(token).digest();
}

export function newToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function idleLimitMs(role: StaffRole): number {
  return (isAdmin(role) ? ADMIN_IDLE_HOURS : SUPPORT_IDLE_HOURS) * HOUR_MS;
}

type SessionCtx = Pick<RequestCtx, "db" | "clock" | "cookies">;

/** Inserts a session row (only the SHA-256 of a fresh token) without touching the cookie. Returns the raw token. */
export async function insertSession(
  tx: Db | Tx,
  clock: RequestCtx["clock"],
  userId: string,
): Promise<string> {
  const token = newToken();
  const now = clock.now();
  await tx
    .insert(sessions)
    .values({ idHash: hashToken(token), userId, createdAt: now, lastActiveAt: now });
  return token;
}

/** Stores only the SHA-256 of a fresh token and sets the cookie. Returns the session id (hex of the hash). */
export async function createSession(ctx: SessionCtx, userId: string): Promise<string> {
  const token = await insertSession(ctx.db, ctx.clock, userId);
  ctx.cookies.set(token);
  return hashToken(token).toString("hex");
}

/** Deletes the session row for a raw cookie token (no cookie change). */
export async function deleteSessionByToken(tx: Db | Tx, token: string): Promise<void> {
  await tx.delete(sessions).where(eq(sessions.idHash, hashToken(token)));
}

/** Null when there is no cookie, no row, or any validity rule fails (LLD §18.2). Never writes. */
export async function readSession(ctx: SessionCtx): Promise<SessionInfo | null> {
  const token = ctx.cookies.get();
  if (!token) return null;
  const idHash = hashToken(token);
  const [row] = await ctx.db
    .select({
      session: sessions,
      user: users,
      branchActive: branches.active,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .leftJoin(branches, eq(branches.id, users.branchId))
    .where(eq(sessions.idHash, idHash))
    .limit(1);
  if (!row) return null;

  const { session, user } = row;
  const now = ctx.clock.now().getTime();
  if (!user.active) return null;
  if (user.branchId !== null && row.branchActive !== true) return null;
  if (now >= session.lastActiveAt.getTime() + idleLimitMs(user.role)) return null;
  if (now >= session.createdAt.getTime() + SESSION_MAX_DAYS * DAY_MS) return null;

  return {
    sessionId: idHash.toString("hex"),
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      branchId: user.branchId,
      mustSetPassword: user.mustSetPassword,
    },
    createdAt: session.createdAt,
    lastActiveAt: session.lastActiveAt,
  };
}

/** Moves last_active_at to now at most once per 60 s. Returns whether it moved. */
export async function touchSession(
  ctx: Pick<RequestCtx, "db" | "clock">,
  info: SessionInfo,
): Promise<boolean> {
  const now = ctx.clock.now();
  const cutoff = new Date(now.getTime() - TOUCH_INTERVAL_MS);
  const moved = await ctx.db
    .update(sessions)
    .set({ lastActiveAt: now })
    .where(
      and(
        eq(sessions.idHash, Buffer.from(info.sessionId, "hex")),
        lte(sessions.lastActiveAt, cutoff),
      ),
    )
    .returning({ idHash: sessions.idHash });
  return moved.length > 0;
}

/** Sign-out of this session: deletes the row and clears the cookie. */
export async function endSession(ctx: SessionCtx): Promise<void> {
  const token = ctx.cookies.get();
  if (token) await ctx.db.delete(sessions).where(eq(sessions.idHash, hashToken(token)));
  ctx.cookies.clear();
}

/** Ends all of a user's sessions, except `exceptId` (a session id from `SessionInfo`) when given. */
export async function endUserSessions(
  tx: Db | Tx,
  userId: string,
  exceptId?: string,
): Promise<void> {
  const mine = eq(sessions.userId, userId);
  await tx
    .delete(sessions)
    .where(exceptId ? and(mine, ne(sessions.idHash, Buffer.from(exceptId, "hex"))) : mine);
}
