import type { AuthRepo } from "@/data/access/repos/auth";
import { err, ok, type Result } from "@/data/access/result";
import { MIN_PASSWORD_LENGTH } from "@/domain/constants";
import type { User } from "@/domain/types";
import { hashPassword } from "../crypto";
import type { StoredUser } from "../db";
import type { RepoDeps } from "../repoDeps";
import { guardRead, guardWrite } from "../results";
import { toPublicUser } from "../session";
import { appendAudit } from "./auditWriter";

const DEMO_USERS = { admin: "u-admin", support1: "u-support1", support2: "u-support2" } as const;
const BAD_CREDENTIALS = "Email or password is incorrect";
const ACCOUNT_DISABLED = "Account disabled, contact admin";

export class LocalAuthRepo implements AuthRepo {
  constructor(protected readonly deps: RepoDeps) {}

  readonly signIn: AuthRepo["signIn"] = (email, password) =>
    guardRead(async () => {
      await this.deps.store.whenReady();
      const wanted = email.trim().toLowerCase();
      const user = this.deps.store.read("users").find((u) => u.email.toLowerCase() === wanted);
      if (user?.passwordHash !== (await hashPassword(password))) {
        return err("BAD_CREDENTIALS", BAD_CREDENTIALS);
      }
      return this.startSession(user);
    });

  readonly signInAsDemo: AuthRepo["signInAsDemo"] = (who) =>
    guardRead(async () => {
      await this.deps.store.whenReady();
      const user = this.deps.store.read("users").find((u) => u.id === DEMO_USERS[who]);
      return user === undefined ? err("NOT_FOUND", "Demo user not found") : this.startSession(user);
    });

  readonly setOwnPassword: AuthRepo["setOwnPassword"] = (newPassword) =>
    guardWrite(async () => {
      await this.deps.store.whenReady();
      const me = this.deps.session.current();
      if (me === null) return err("UNAUTHENTICATED", "Sign in first");
      if (newPassword.length < MIN_PASSWORD_LENGTH) {
        return err("VALIDATION", `Use at least ${String(MIN_PASSWORD_LENGTH)} characters`, [
          "password",
        ]);
      }
      return this.savePassword(me, await hashPassword(newPassword));
    });

  readonly signOut: AuthRepo["signOut"] = () =>
    guardWrite(async () => {
      await Promise.resolve();
      this.deps.store.writeSession(null);
      return ok(undefined);
    });

  readonly currentUser: AuthRepo["currentUser"] = () =>
    guardRead(async () => {
      await this.deps.store.whenReady();
      return ok(this.deps.session.current());
    });

  private startSession(user: StoredUser): Result<User> {
    if (!user.active) return err("ACCOUNT_DISABLED", ACCOUNT_DISABLED);
    this.deps.store.writeSession(user.id);
    return ok(toPublicUser(user));
  }

  private async savePassword(me: User, passwordHash: string): Promise<Result<User>> {
    const now = this.deps.clock.now();
    const saved = await this.deps.store.mutate(["users", "audit"], (d) => {
      const user = d.users.find((u) => u.id === me.id);
      if (user === undefined) return null;
      const before = { mustSetPassword: user.mustSetPassword };
      Object.assign(user, { passwordHash, mustSetPassword: false });
      appendAudit(
        d,
        {
          actorId: user.id,
          actorName: user.name,
          action: "user.set_password",
          entityType: "user",
          entityId: user.id,
          oldValue: before,
          newValue: { mustSetPassword: false },
        },
        now,
      );
      return toPublicUser(user);
    });
    return saved === null ? err("NOT_FOUND", "User not found") : ok(saved);
  }
}
