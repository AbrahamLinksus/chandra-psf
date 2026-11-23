import "server-only";
import { and, count, eq, gte, sql, type SQL } from "drizzle-orm";
import type { AuthRepo } from "@/data/access";
import { err, ok, type Result } from "@/data/access/result";
import { passwordProblem } from "@/domain/passwordPolicy";
import type { User } from "@/domain/types";
import { DUMMY_HASH, hashPassword, verifyPassword } from "../auth/password";
import { deleteSessionByToken, endSession, endUserSessions, insertSession } from "../auth/session";
import { writeAudit } from "../audit";
import { guard, type RequestCtx } from "../ctx";
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

type UserRow = typeof users.$inferSelect;
type Found = { user: UserRow; branchActive: boolean | null; branchName: string | null };

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

  private async failures(match: SQL): Promise<number> {
    const since = new Date(this.ctx.clock.now().getTime() - WINDOW_MS);
    const [row] = await this.ctx.db
      .select({ n: count() })
      .from(loginAttempts)
      .where(and(eq(loginAttempts.kind, "signin"), match, gte(loginAttempts.at, since)));
    return row?.n ?? 0;
  }

  /** Records the failure; the 5th for one email is audited once as a lockout. */
  private async recordFailure(emailKey: string, known: UserRow | undefined): Promise<void> {
    await this.ctx.db.insert(loginAttempts).values({
      emailKey,
      ipHash: hashIp(this.ctx.ip),
      at: this.ctx.clock.now(),
      kind: "signin",
      userId: known?.id ?? null,
    });
    const n = await this.failures(eq(loginAttempts.emailKey, emailKey));
    if (n === EMAIL_FAILURE_LIMIT) await this.auditLockout(known);
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

  private async isLocked(emailKey: string): Promise<boolean> {
    const byIp = await this.failures(eq(loginAttempts.ipHash, hashIp(this.ctx.ip)));
    if (byIp >= IP_FAILURE_LIMIT) return true;
    return (await this.failures(eq(loginAttempts.emailKey, emailKey))) >= EMAIL_FAILURE_LIMIT;
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

  private async doSignIn(email: string, password: string): Promise<Result<User>> {
    const emailKey = email.trim().toLowerCase();
    if (await this.isLocked(emailKey)) return err("RATE_LIMITED", LOCKED);
    const found = await this.find(eq(sql`lower(${users.email})`, emailKey));
    const matches = await verifyPassword(found?.user.passwordHash ?? DUMMY_HASH, password);
    if (!found || !matches) {
      await this.recordFailure(emailKey, found?.user);
      return err("BAD_CREDENTIALS", BAD_CREDENTIALS);
    }
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
    this.ctx.cookies.set(token);
    return ok(toUser({ ...user, lastSignInAt: now }, found.branchName));
  }

  private async doSetPassword(newPassword: string): Promise<Result<User>> {
    const staff = requireStaff(this.ctx);
    if (!staff.ok) return staff;
    const session = staff.value;
    if (!session.user.mustSetPassword) return err("FORBIDDEN", "You can't do that.");
    const problem = passwordProblem(newPassword);
    if (problem === "too_short") {
      return err("VALIDATION", "Use at least 8 characters", ["password"]);
    }
    if (problem === "too_common") {
      return err("VALIDATION", "That password is too common. Choose another.", ["password"]);
    }
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
}
