import { users, branches } from "@/server/db/schema";
import type { Db } from "@/server/db/client";
import type { Clock, RequestCtx, SessionCookies } from "@/server/ctx";
import { createLogger } from "@/server/log";
import { createTestDb } from "./pglite";

export class FakeCookies implements SessionCookies {
  value: string | undefined;
  cleared = 0;
  get(): string | undefined {
    return this.value;
  }
  set(token: string): void {
    this.value = token;
  }
  clear(): void {
    this.value = undefined;
    this.cleared += 1;
  }
}

export class MutableClock implements Clock {
  constructor(public at: Date) {}
  now(): Date {
    return new Date(this.at);
  }
  advance(ms: number): void {
    this.at = new Date(this.at.getTime() + ms);
  }
}

export const T0 = new Date("2026-03-10T06:30:00.000Z");

/** A request context over a fresh PGlite, with a controllable clock, fake cookies and a captured log. */
export async function makeServerCtx() {
  const { client, db } = await createTestDb();
  const clock = new MutableClock(T0);
  const cookies = new FakeCookies();
  const lines: string[] = [];
  const ctx: RequestCtx = {
    db,
    clock,
    session: null,
    scope: null,
    ip: "127.0.0.1",
    cookies,
    log: createLogger(
      (l) => lines.push(l),
      () => clock.now(),
    ),
  };
  return { ctx, db, clock, cookies, lines, client };
}

export async function seedBranch(db: Db, name: string, active = true): Promise<string> {
  const [row] = await db.insert(branches).values({ name, city: "Chennai", active }).returning();
  return must(row).id;
}

export async function seedUser(
  db: Db,
  o: {
    role: "support" | "branch_admin" | "main_admin";
    branchId?: string | null;
    active?: boolean;
    email?: string;
    name?: string;
  },
): Promise<string> {
  const [row] = await db
    .insert(users)
    .values({
      name: o.name ?? "Test User",
      email: o.email ?? `${o.role}-${Math.random().toString(36).slice(2)}@example.in`,
      passwordHash: "x",
      role: o.role,
      branchId: o.role === "main_admin" ? null : (o.branchId ?? null),
      active: o.active ?? true,
    })
    .returning();
  return must(row).id;
}

/** Narrows a possibly-missing value in tests; fails loudly when it is missing. */
export function must<T>(v: T | null | undefined): T {
  if (v === null || v === undefined) throw new Error("expected a value");
  return v;
}
