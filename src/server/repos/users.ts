import "server-only";
import { and, count, eq, ne, sql } from "drizzle-orm";
import type { UserRepo } from "@/data/access";
import { err, ok, type Result } from "@/data/access/result";
import { isMainAdmin } from "@/domain/roles";
import type { Role, User } from "@/domain/types";
import { writeAudit } from "../audit";
import { hashPassword } from "../auth/password";
import { endUserSessions } from "../auth/session";
import { guard, type RequestCtx } from "../ctx";
import type { Tx } from "../db/client";
import { branches, users } from "../db/schema";
import { requireAdmin, scopeOf, branchFilter } from "../scope";
import { clearSignInFailures } from "./auth";
import { isUniqueViolation } from "./branches";
import {
  assertCanManage,
  cleanPatch,
  diff,
  EMAIL_IN_USE,
  LAST_ADMIN,
  NOT_FOUND,
  OTP_TTL_MS,
  snapshot,
  tempPasswordError,
  wantedBranch,
  toUser,
  type Change,
  type Fields,
  type Patch,
  type Row,
  type Target,
} from "./userRules";

export class ServerUserRepo implements UserRepo {
  constructor(protected readonly ctx: RequestCtx) {}

  listUsers: UserRepo["listUsers"] = (f) =>
    guard(this.ctx, "users.listUsers", "read", async () => {
      const auth = requireAdmin(this.ctx);
      if (!auth.ok) return auth;
      const where = branchFilter(users.branchId, scopeOf(auth.value.user), f?.branchId);
      const rows = await this.ctx.db
        .select({ user: users, branchName: branches.name })
        .from(users)
        .leftJoin(branches, eq(branches.id, users.branchId))
        .where(where)
        .orderBy(users.name);
      return ok(rows.map((r) => toUser(r.user, r.branchName)));
    });

  createUser: UserRepo["createUser"] = (input) =>
    guard(this.ctx, "users.createUser", "write", async () => {
      const ready = await this.validateNew(input);
      if (!ready.ok) return ready;
      const { name, email, branchId } = ready.value;
      const passwordHash = await hashPassword(input.tempPassword);
      const otpExpiresAt = new Date(this.ctx.clock.now().getTime() + OTP_TTL_MS);
      return this.saving(async () => {
        const values = {
          name,
          email,
          role: ready.value.role,
          branchId,
          passwordHash,
          otpExpiresAt,
        };
        const created = await this.ctx.db.transaction(async (tx) => {
          const [row] = await tx
            .insert(users)
            .values({ ...values, mustSetPassword: true })
            .returning();
          if (!row) throw new Error("insert returned no row");
          await writeAudit(this.ctx, tx, {
            action: "user.create",
            entityType: "user",
            entityId: row.id,
            branchId: row.branchId,
            newValue: snapshot(row),
          });
          return row;
        });
        return ok(await this.view(created.id));
      });
    });

  updateUser: UserRepo["updateUser"] = (id, patch) =>
    guard(this.ctx, "users.updateUser", "write", async () => {
      const cleaned = cleanPatch(patch);
      if (!cleaned.ok) return cleaned;
      const found = await this.authorize(id, (t) => this.changesOf(t.row, cleaned.value));
      if (!found.ok) return found;
      const { target } = found.value;
      const p = cleaned.value;
      const after: Fields = {
        name: p.name ?? target.row.name,
        email: p.email ?? target.row.email,
        role: p.role ?? target.row.role,
        branchId: p.branchId === undefined ? target.row.branchId : p.branchId,
      };
      const branch = await this.resolveBranch(after.role, after.branchId, target.row.branchId);
      if (!branch.ok) return branch;
      after.branchId = branch.value;
      if (after.email !== target.row.email && (await this.emailTaken(after.email, id)))
        return err("EMAIL_IN_USE", EMAIL_IN_USE, ["email"]);
      return this.saving(() => this.applyUpdate(target.row, after));
    });

  setUserActive: UserRepo["setUserActive"] = (id, active) =>
    guard(this.ctx, "users.setUserActive", "write", async () => {
      const found = await this.authorize(id, () => ["active"]);
      if (!found.ok) return found;
      const { row } = found.value.target;
      if (row.active === active) return ok(await this.view(id));
      const done = await this.ctx.db.transaction(async (tx) => {
        if (!active && !(await this.keepsAnAdmin(tx, row))) return false;
        await tx
          .update(users)
          .set({ active, updatedAt: this.ctx.clock.now() })
          .where(eq(users.id, id));
        if (!active) await endUserSessions(tx, id);
        await writeAudit(this.ctx, tx, {
          action: active ? "user.reactivate" : "user.deactivate",
          entityType: "user",
          entityId: id,
          branchId: row.branchId,
          oldValue: { active: row.active },
          newValue: { active },
        });
        return true;
      });
      return done ? ok(await this.view(id)) : err("CONFLICT", LAST_ADMIN);
    });

  resetPassword: UserRepo["resetPassword"] = (id, tempPassword) =>
    guard(this.ctx, "users.resetPassword", "write", async () => {
      const bad = tempPasswordError(tempPassword);
      if (bad) return bad;
      const found = await this.authorize(id, () => ["reset"]);
      if (!found.ok) return found;
      const { row } = found.value.target;
      const passwordHash = await hashPassword(tempPassword);
      const now = this.ctx.clock.now();
      await this.ctx.db.transaction(async (tx) => {
        await tx
          .update(users)
          .set({
            passwordHash,
            mustSetPassword: true,
            otpExpiresAt: new Date(now.getTime() + OTP_TTL_MS),
            updatedAt: now,
          })
          .where(eq(users.id, id));
        await endUserSessions(tx, id);
        await clearSignInFailures(tx, row.email);
        await writeAudit(this.ctx, tx, {
          action: "user.reset_password",
          entityType: "user",
          entityId: id,
          branchId: row.branchId,
          newValue: { mustSetPassword: true },
        });
      });
      return ok(undefined);
    });

  /** Checks rights, fields, branch and email for a new user; returns the cleaned values. */
  private async validateNew(input: Parameters<UserRepo["createUser"]>[0]): Promise<Result<Fields>> {
    const auth = requireAdmin(this.ctx);
    if (!auth.ok) return auth;
    const actor = auth.value.user;
    const clean = cleanPatch({ name: input.name, email: input.email });
    if (!clean.ok) return clean;
    const bad = tempPasswordError(input.tempPassword);
    if (bad) return bad;
    const placed = wantedBranch(actor, input);
    if (!placed.ok) return placed;
    const branch = await this.resolveBranch(input.role, placed.value);
    if (!branch.ok) return branch;
    const { name = "", email = "" } = clean.value;
    if (await this.emailTaken(email)) return err("EMAIL_IN_USE", EMAIL_IN_USE, ["email"]);
    return ok({ name, email, role: input.role, branchId: branch.value });
  }

  private changesOf(row: Row, p: Patch): Change[] {
    const out: Change[] = [];
    if (p.name !== undefined || p.email !== undefined) out.push("profile");
    if (p.role !== undefined && p.role !== row.role) out.push("role");
    if (p.branchId !== undefined && p.branchId !== row.branchId) out.push("branch");
    return out;
  }

  private async find(id: string): Promise<Target | undefined> {
    const [found] = await this.ctx.db
      .select({ row: users, branchName: branches.name })
      .from(users)
      .leftJoin(branches, eq(branches.id, users.branchId))
      .where(eq(users.id, id))
      .limit(1);
    return found;
  }

  /** Loads the target and applies the manage rules; the actor is the signed-in admin. */
  private async authorize(
    id: string,
    changes: (t: Target) => Change[],
  ): Promise<Result<{ target: Target }>> {
    const auth = requireAdmin(this.ctx);
    if (!auth.ok) return auth;
    const found = await this.find(id);
    if (!found) return err("NOT_FOUND", NOT_FOUND);
    const allowed = assertCanManage(auth.value.user, found.row, changes(found));
    return allowed.ok ? ok({ target: found }) : allowed;
  }

  private async view(id: string): Promise<User> {
    const found = await this.find(id);
    if (!found) throw new Error("user vanished");
    return toUser(found.row, found.branchName);
  }

  /** Main admins have no branch; everyone else needs an active one ("Add a branch first" when none exists). */
  private async resolveBranch(
    role: Role,
    wanted: string | null,
    current?: string | null,
  ): Promise<Result<string | null>> {
    if (isMainAdmin(role)) return ok(null);
    if (current && wanted === current) return ok(wanted);
    const rows = await this.ctx.db
      .select({ id: branches.id })
      .from(branches)
      .where(eq(branches.active, true));
    if (rows.length === 0) return err("VALIDATION", "Add a branch first", ["branchId"]);
    if (!wanted) return err("VALIDATION", "Choose a branch", ["branchId"]);
    if (rows.some((r) => r.id === wanted)) return ok(wanted);
    return err("VALIDATION", "Choose an active branch", ["branchId"]);
  }

  private async emailTaken(email: string, exceptId?: string): Promise<boolean> {
    const same = sql`lower(${users.email}) = ${email.toLowerCase()}`;
    const [row] = await this.ctx.db
      .select({ n: count() })
      .from(users)
      .where(exceptId ? and(same, ne(users.id, exceptId)) : same);
    return (row?.n ?? 0) > 0;
  }

  /**
   * False when no other active main admin would remain after `row` is deactivated or demoted.
   * Locks every active main admin row (FOR UPDATE) before counting, so two concurrent
   * demotions/deactivations queue up; the second re-reads the committed set and sees the truth.
   */
  private async keepsAnAdmin(tx: Tx, row: Row): Promise<boolean> {
    if (row.role !== "main_admin") return true;
    const locked = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, "main_admin"), eq(users.active, true)))
      .for("update");
    return locked.some((r) => r.id !== row.id);
  }

  private async applyUpdate(before: Row, after: Fields): Promise<Result<User>> {
    const changes = diff(snapshot(before), after);
    if (Object.keys(changes.newValue).length === 0) return ok(await this.view(before.id));
    const moved = after.role !== before.role || after.branchId !== before.branchId;
    const done = await this.ctx.db.transaction(async (tx) => {
      if (after.role !== before.role && !(await this.keepsAnAdmin(tx, before))) return false;
      await tx
        .update(users)
        .set({ ...after, updatedAt: this.ctx.clock.now() })
        .where(eq(users.id, before.id));
      if (moved) await endUserSessions(tx, before.id);
      await writeAudit(this.ctx, tx, {
        action: "user.update",
        entityType: "user",
        entityId: before.id,
        branchId: after.branchId,
        ...changes,
      });
      return true;
    });
    return done ? ok(await this.view(before.id)) : err("CONFLICT", LAST_ADMIN);
  }

  private async saving(run: () => Promise<Result<User>>): Promise<Result<User>> {
    try {
      return await run();
    } catch (e) {
      if (isUniqueViolation(e)) return err("EMAIL_IN_USE", EMAIL_IN_USE, ["email"]);
      throw e;
    }
  }
}
