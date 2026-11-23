import { err, type Result } from "@/data/access/result";
import type { StaffRole } from "@/domain/roles";
import type { Logger } from "./log";
import type { Db } from "./db/client";

export interface Clock {
  now(): Date;
}

export type Scope = { kind: "all" } | { kind: "branch"; branchId: string };

/** The signed-in user as the server sees them (no password hash). */
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  branchId: string | null;
  mustSetPassword: boolean;
}

export interface SessionInfo {
  /** Hex of the stored SHA-256, never the raw token. */
  sessionId: string;
  user: SessionUser;
  createdAt: Date;
  lastActiveAt: Date;
}

/** Cookie access for the session token; Next `cookies()` in the route, a fake in tests. */
export interface SessionCookies {
  get(): string | undefined;
  set(token: string): void;
  clear(): void;
}

export interface RequestCtx {
  db: Db;
  clock: Clock;
  session: SessionInfo | null;
  scope: Scope | null;
  ip: string;
  cookies: SessionCookies;
  log: Logger;
}

export type MethodKind = "read" | "write";

const SAFE_CLASS = /^[A-Za-z]\w{0,63}$/;

function errorClass(e: unknown): string {
  const name = e instanceof Error ? e.constructor.name : "";
  return SAFE_CLASS.test(name) ? name : "UnknownError";
}

/** Runs a repo method body; a thrown error becomes SAVE_FAILED (write) or UNAVAILABLE (read). Logs the error class only. */
export async function guard<T>(
  ctx: Pick<RequestCtx, "log">,
  where: string,
  kind: MethodKind,
  fn: () => Promise<Result<T>>,
): Promise<Result<T>> {
  try {
    return await fn();
  } catch (e) {
    try {
      ctx.log.error(where, errorClass(e));
    } catch {
      // a bad `where` must not turn into a thrown error
    }
    return kind === "write"
      ? err("SAVE_FAILED", "Couldn't save, try again.")
      : err("UNAVAILABLE", "Couldn't load, try again.");
  }
}
