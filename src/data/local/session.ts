import type { User } from "@/domain/types";
import type { StoredUser } from "./db";
import type { LocalStore } from "./store";

export interface SessionReader {
  /** The signed-in, still-active user, or null. */
  current(): User | null;
}

/** Strips the password hash. */
export function toPublicUser(u: StoredUser): User {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    active: u.active,
    mustSetPassword: u.mustSetPassword,
    createdAt: u.createdAt,
  };
}

export class StoreSessionReader implements SessionReader {
  constructor(private readonly store: LocalStore) {}

  current(): User | null {
    try {
      const session = this.store.readSession();
      if (session === null) return null;
      const user = this.store.read("users").find((u) => u.id === session.userId);
      return user?.active === true ? toPublicUser(user) : null;
    } catch {
      return null;
    }
  }
}
