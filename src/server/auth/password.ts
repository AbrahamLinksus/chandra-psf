// No "server-only" import: scripts/admin.ts (tsx) hashes with this too.
import { hash, verify } from "@node-rs/argon2";
import { isHashTimingEnabled } from "../env";

// argon2id (Algorithm.Argon2id = 2), LLD §18.1; time cost raised 2 -> 8 (D-29) to reach >= 100 ms.
const ARGON2 = { algorithm: 2, memoryCost: 19456, timeCost: 8, parallelism: 1 } as const;

/** A valid hash of a random throwaway string: verified for unknown emails so timing matches (S-16). */
export const DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=8,p=1$Bu4LIM/bhVSVkn1IPaW/Kw$xOi36NQEx/EZaZrjp0sglTYEG+Kq2woZRtiuLGyoqNY";

/** The `$argon2id$v=19$m=..,t=..,p=..$` prefix a hash made with these params carries. */
export const ARGON2_PARAM_PREFIX = `$argon2id$v=19$m=${String(ARGON2.memoryCost)},t=${String(ARGON2.timeCost)},p=${String(ARGON2.parallelism)}$`;

// Fail at load if ARGON2 changes but DUMMY_HASH is not regenerated: timing must match (S-16).
if (!DUMMY_HASH.startsWith(ARGON2_PARAM_PREFIX)) {
  throw new Error("DUMMY_HASH params differ from ARGON2; regenerate DUMMY_HASH.");
}

/** Opt-in (AUTH_HASH_TIMING=1) duration log: only the operation and milliseconds, nothing sensitive. */
async function timed<T>(op: "hash" | "verify", run: () => Promise<T>): Promise<T> {
  if (!isHashTimingEnabled()) return run();
  const start = performance.now();
  try {
    return await run();
  } finally {
    const ms = Math.round((performance.now() - start) * 10) / 10;
    process.stderr.write(`${JSON.stringify({ evt: "auth.hash_timing", op, ms })}\n`);
  }
}

export function hashPassword(password: string): Promise<string> {
  return timed("hash", () => hash(password, ARGON2));
}

/** True when a stored hash was made with other params than the current ones (re-hash on sign-in). */
export function needsRehash(passwordHash: string): boolean {
  return !passwordHash.startsWith(ARGON2_PARAM_PREFIX);
}

/** False for a wrong password or an unreadable hash; never throws. */
export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await timed("verify", () => verify(passwordHash, password));
  } catch {
    return false;
  }
}
