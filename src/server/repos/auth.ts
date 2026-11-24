import "server-only";
import { and, count, eq, gte, sql, type SQL } from "drizzle-orm";
import type { AuthRepo } from "@/data/access";
import { err, ok, type Result } from "@/data/access/result";
import { MIN_PASSWORD_LENGTH } from "@/domain/constants";
import { passwordProblem } from "@/domain/passwordPolicy";
import type { User } from "@/domain/types";
import { DUMMY_HASH, hashPassword, needsRehash, verifyPassword } from "../auth/password";
import { verifyStepUp } from "../auth/stepUp";
import { deleteSessionByToken, endSession, endUserSessions, insertSession } from "../auth/session";
import { writeAudit } from "../audit";
import { guard, type RequestCtx } from "../ctx";
import type { Db, Tx } from "../db/client";
import { branches, loginAttempts, users } from "../db/schema";
import { hashIp } from "../rateLimit";
import { requireStaff } from "../scope";

const WINDOW_MS = 15 * 60_000;
const EMAIL_FAILURE_LIMIT = 5;
const IP_FAILURE_LIMIT = 30;
const BAD_CREDENTIALS = "Email or password is incorrect";
const DISABLED = "Account disabled, contact admin";
const OTP_EXPIRED = "This one-time password has expired. Ask for a new one.";
const LOCKED = "Too many attempts. Try again in 15 minutes.";

/** Admin password reset: forget an email's sign-in failures so the lock clears early (LLD §18.3). */
export async function clearSignInFailures(tx: Db | Tx, email: string): Promise<void> {
  const emailKey = email.trim().toLowerCase();
  await tx
    .delete(loginAttempts)
    .where(and(eq(loginAttempts.kind, "signin"), eq(loginAttempts.emailKey, emailKey)));
}

function newPasswordError(newPassword: string): Result<never> | null {
  const problem = passwordProblem(newPassword);
  if (problem === "too_short") {
    return err("VALIDATION", `Use at least ${String(MIN_PASSWORD_LENGTH)} characters`, [
      "password",
    ]);
  }
  if (problem === "too_common") {
    return err("VALIDATION", "That password is too common. Choose another.", ["password"]);
  }
  return null;
}

type UserRow = typeof users.$inferSelect;
type Found = { user: UserRow; branchActive: boolean | null; branchName: string | null };
type Reserved = { id: number; fifth: boolean };

function toUser(row: UserRow, branchName: string | null): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    active: row.active,
    mustSetPassword: row.mustSetPassword,
    branchId: row.branchId,
    branchName,
    lastSignInAt: row.lastSignInAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export class ServerAuthRepo implements AuthRepo {
  constructor(protected readonly ctx: RequestCtx) {}

  signIn: AuthRepo["signIn"] = (email, password) =>
    guard(this.ctx, "auth.signIn", "write", () => this.doSignIn(email, password));

  setOwnPassword: AuthRepo["setOwnPassword"] = (newPassword) =>
    guard(this.ctx, "auth.setOwnPassword", "write", () => this.doSetPassword(newPassword));

  changePassword: AuthRepo["changePassword"] = (currentPassword, newPassword) =>
    guard(this.ctx, "auth.changePassword", "write", () =>
      this.doChangePassword(currentPassword, newPassword),
    );

  signOut: AuthRepo["signOut"] = () =>
    guard(this.ctx, "auth.signOut", "write", async () => {
      await endSession(this.ctx);
      return ok(undefined);
    });

  currentUser: AuthRepo["currentUser"] = () =>
    guard(this.ctx, "auth.currentUser", "read", async () => {
      const session = this.ctx.session;
      if (!session) return ok(null);
      const found = await this.find(eq(users.id, session.user.id));
      return ok(found ? toUser(found.user, found.branchName) : null);
    });

  private async find(where: SQL): Promise<Found | undefined> {
    const [row] = await this.ctx.db
      .select({ user: users, branchActive: branches.active, branchName: branches.name })
      .from(users)
      .leftJoin(branches, eq(branches.id, users.branchId))
      .where(where)
      .limit(1);
    return row;
  }

  private async failures(match: SQL, db: Db | Tx = this.ctx.db): Promise<number> {
    const since = new Date(this.ctx.clock.now().getTime() - WINDOW_MS);
    const [row] = await db
      .select({ n: count() })
      .from(loginAttempts)
      .where(and(eq(loginAttempts.kind, "signin"), match, gte(loginAttempts.at, since)));
    return row?.n ?? 0;
  }

  /**
   * Reserves a guess before the password is checked (LLD §18.3 steps 1, 2 and 4), serialised per
   * address and per email so parallel requests can't pass the caps. Null when locked; otherwise the
   * attempt row's id and whether it is the email's 5th failure (the one audited as a lockout).
   */
  private async reserve(emailKey: string, known: UserRow | undefined): Promise<Reserved | null> {
    const ipHash = hashIp(this.ctx.ip);
    return this.ctx.db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`signin-ip:${ipHash.toString("hex")}`}))`,
      );
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`signin:${emailKey}`}))`);
      if ((await this.failures(eq(loginAttempts.ipHash, ipHash), tx)) >= IP_FAILURE_LIMIT)
        return null;
      const byEmail = await this.failures(eq(loginAttempts.emailKey, emailKey), tx);
      if (byEmail >= EMAIL_FAILURE_LIMIT) return null;
      const [row] = await tx
        .insert(loginAttempts)
        .values({
          emailKey,
          ipHash,
          at: this.ctx.clock.now(),
          kind: "signin",
          userId: known?.id ?? null,
        })
        .returning({ id: loginAttempts.id });
      return { id: row?.id ?? 0, fifth: byEmail === EMAIL_FAILURE_LIMIT - 1 };
    });
  }

  private async auditLockout(known: UserRow | undefined): Promise<void> {
    await writeAudit(this.ctx, this.ctx.db, {
      action: "auth.lockout",
      entityType: "user",
      entityId: known?.id ?? "unknown",
      branchId: known?.branchId ?? null,
      actor: { id: known?.id ?? null, name: known?.name ?? "Unknown" },
    });
  }

  /** Steps 5 and 6 of LLD §18.3 for a correct password. */
  private blocker(found: Found): Result<never> | null {
    const { user } = found;
    if (!user.active || (user.branchId !== null && found.branchActive !== true)) {
      return err("ACCOUNT_DISABLED", DISABLED);
    }
    const expired =
      user.mustSetPassword && user.otpExpiresAt && user.otpExpiresAt <= this.ctx.clock.now();
    return expired ? err("OTP_EXPIRED", OTP_EXPIRED) : null;
  }

  /** Upgrades a hash made with older argon2 params (D-29); a failure here never fails the sign-in. */
  private async rehashIfStale(user: UserRow, password: string): Promise<void> {
    if (!needsRehash(user.passwordHash)) return;
    try {
      const passwordHash = await hashPassword(password);
      // Conditional on the hash we verified: if it changed meanwhile (reset, new password), write nothing.
      await this.ctx.db
        .update(users)
        .set({ passwordHash })
        .where(and(eq(users.id, user.id), eq(users.passwordHash, user.passwordHash)));
    } catch (e) {
      // keep the old hash; it still verifies and is retried on the next sign-in
      this.ctx.log.error("auth.rehash", e instanceof Error ? e.name : "unknown");
    }
  }

  private async doSignIn(email: string, password: string): Promise<Result<User>> {
    const emailKey = email.trim().toLowerCase();
    const found = await this.find(eq(sql`lower(${users.email})`, emailKey));
    const reserved = await this.reserve(emailKey, found?.user);
    if (!reserved) return err("RATE_LIMITED", LOCKED);
    const matches = await verifyPassword(found?.user.passwordHash ?? DUMMY_HASH, password);
    if (!found || !matches) {
      if (reserved.fifth) await this.auditLockout(found?.user);
      return err("BAD_CREDENTIALS", BAD_CREDENTIALS);
    }
    await this.ctx.db.delete(loginAttempts).where(eq(loginAttempts.id, reserved.id));
    const blocked = this.blocker(found);
    if (blocked) return blocked;
    const { user } = found;
    const now = this.ctx.clock.now();
    const held = this.ctx.cookies.get();
    const token = await this.ctx.db.transaction(async (tx) => {
      if (held) await deleteSessionByToken(tx, held);
      const fresh = await insertSession(tx, this.ctx.clock, user.id);
      await tx.update(users).set({ lastSignInAt: now }).where(eq(users.id, user.id));
      await writeAudit(this.ctx, tx, {
        action: "auth.sign_in",
        entityType: "user",
        entityId: user.id,
        branchId: user.branchId,
        actor: { id: user.id, name: user.name },
      });
      return fresh;
    });
    await this.rehashIfStale(user, password);
    this.ctx.cookies.set(token);
    return ok(toUser({ ...user, lastSignInAt: now }, found.branchName));
  }

  private async doSetPassword(newPassword: string): Promise<Result<User>> {
    const staff = requireStaff(this.ctx);
    if (!staff.ok) return staff;
    const session = staff.value;
    if (!session.user.mustSetPassword) return err("FORBIDDEN", "You can't do that.");
    const invalid = newPasswordError(newPassword);
    if (invalid) return invalid;
    const passwordHash = await hashPassword(newPassword);
    const now = this.ctx.clock.now();
    const { db } = this.ctx;
    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(users)
        .set({ passwordHash, mustSetPassword: false, otpExpiresAt: null, updatedAt: now })
        .where(eq(users.id, session.user.id))
        .returning();
      await endUserSessions(tx, session.user.id, session.sessionId);
      await writeAudit(this.ctx, tx, {
        action: "user.set_password",
        entityType: "user",
        entityId: session.user.id,
      });
      return row;
    });
    if (!updated) return err("NOT_FOUND", "Not found.");
    const found = await this.find(eq(users.id, updated.id));
    return ok(toUser(updated, found?.branchName ?? null));
  }

  private async doChangePassword(current: string, newPassword: string): Promise<Result<void>> {
    const staff = requireStaff(this.ctx);
    if (!staff.ok) return staff;
    const { user, sessionId } = staff.value;
    const invalid = newPasswordError(newPassword);
    if (invalid) return invalid;
    const verified = await verifyStepUp(this.ctx, { password: current });
    if (!verified.ok) return verified;
    const passwordHash = await hashPassword(newPassword);
    await this.ctx.db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ passwordHash, updatedAt: this.ctx.clock.now() })
        .where(eq(users.id, user.id));
      await endUserSessions(tx, user.id, sessionId);
      await writeAudit(this.ctx, tx, {
        action: "user.change_password",
        entityType: "user",
        entityId: user.id,
      });
    });
    return ok(undefined);
  }
}
