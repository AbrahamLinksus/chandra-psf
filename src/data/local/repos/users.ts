import type { UserRepo } from "@/data/access/repos/users";
import { err, ok, type Result } from "@/data/access/result";
import { MIN_PASSWORD_LENGTH } from "@/domain/constants";
import type { User } from "@/domain/types";
import { hashPassword } from "../crypto";
import type { Db } from "../db";
import { newId } from "../ids";
import type { RepoDeps } from "../repoDeps";
import { guardRead, guardWrite } from "../results";
import { toPublicUser } from "../session";
import { appendAudit } from "./auditWriter";

const ADMIN_ONLY = "Only an admin can manage users";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type NewUser = Parameters<UserRepo["createSupportUser"]>[0];
type Draft = Pick<Db, "users" | "audit">;

/** Field names that fail validation (G-05). */
function invalidFields(i: NewUser): string[] {
  const fields: string[] = [];
  if (i.name.trim() === "") fields.push("name");
  if (!EMAIL_PATTERN.test(i.email.trim())) fields.push("email");
  if (i.tempPassword.length < MIN_PASSWORD_LENGTH) fields.push("tempPassword");
  return fields;
}

export class LocalUserRepo implements UserRepo {
  constructor(protected readonly deps: RepoDeps) {}

  readonly listUsers: UserRepo["listUsers"] = () =>
    guardRead(async () => {
      await this.deps.store.whenReady();
      const denied = this.denied();
      if (denied !== null) return denied;
      return ok(this.deps.store.read("users").map(toPublicUser));
    });

  readonly createSupportUser: UserRepo["createSupportUser"] = (input) =>
    guardWrite(async () => {
      await this.deps.store.whenReady();
      const me = this.deps.session.current();
      const denied = this.denied();
      if (me === null || denied !== null) return denied ?? err("UNAUTHENTICATED", "Sign in first");
      const fields = invalidFields(input);
      if (fields.length > 0) return err("VALIDATION", "Check the highlighted fields", fields);
      const passwordHash = await hashPassword(input.tempPassword);
      const now = this.deps.clock.now();
      return this.deps.store.mutate(["users", "audit"], (d) =>
        this.insertUser(d, me, input, passwordHash, now),
      );
    });

  readonly setUserActive: UserRepo["setUserActive"] = (id, active) =>
    guardWrite(async () => {
      await this.deps.store.whenReady();
      const me = this.deps.session.current();
      const denied = this.denied();
      if (me === null || denied !== null) return denied ?? err("UNAUTHENTICATED", "Sign in first");
      if (me.id === id) return err("FORBIDDEN", "You can't deactivate your own account");
      const now = this.deps.clock.now();
      return this.deps.store.mutate(["users", "audit"], (d) => this.flipActive(d, me, id, active, now));
    });

  /** null when the caller is a signed-in admin, otherwise the error to return. */
  private denied(): Result<never> | null {
    const me = this.deps.session.current();
    if (me === null) return err("UNAUTHENTICATED", "Sign in first");
    return me.role === "admin" ? null : err("FORBIDDEN", ADMIN_ONLY);
  }

  private insertUser(
    d: Draft,
    me: User,
    input: NewUser,
    passwordHash: string,
    now: Date,
  ): Result<User> {
    const email = input.email.trim().toLowerCase();
    if (d.users.some((u) => u.email.toLowerCase() === email)) {
      return err("EMAIL_IN_USE", "Email already in use", ["email"]);
    }
    const user = {
      id: newId("u"),
      name: input.name.trim(),
      email,
      role: "support" as const,
      active: true,
      mustSetPassword: true,
      createdAt: now.toISOString(),
      passwordHash,
    };
    d.users.push(user);
    appendAudit(
      d,
      {
        actorId: me.id,
        actorName: me.name,
        action: "user.create",
        entityType: "user",
        entityId: user.id,
        oldValue: null,
        newValue: { name: user.name, email, role: user.role },
      },
      now,
    );
    return ok(toPublicUser(user));
  }

  private flipActive(d: Draft, me: User, id: string, active: boolean, now: Date): Result<User> {
    const user = d.users.find((u) => u.id === id);
    if (user === undefined) return err("NOT_FOUND", "User not found");
    if (user.active !== active) {
      user.active = active;
      appendAudit(
        d,
        {
          actorId: me.id,
          actorName: me.name,
          action: active ? "user.reactivate" : "user.deactivate",
          entityType: "user",
          entityId: user.id,
          oldValue: { active: !active },
          newValue: { active },
        },
        now,
      );
    }
    return ok(toPublicUser(user));
  }
}
