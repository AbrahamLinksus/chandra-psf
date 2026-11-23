// No "server-only" import: scripts/admin.ts (tsx) hashes with this too.
import { hash, verify } from "@node-rs/argon2";

// argon2id (Algorithm.Argon2id = 2), LLD §18.1.
const ARGON2 = { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

/** A valid hash of a random throwaway string: verified for unknown emails so timing matches (S-16). */
export const DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$411815+P70XRTzu6W53EBQ$9F8bpMKYhjlWsZ+K4Rh2ZpiDAO5PLoO0nW1oy+wwDLc";

/** The `$argon2id$v=19$m=..,t=..,p=..$` prefix a hash made with these params carries. */
export const ARGON2_PARAM_PREFIX = `$argon2id$v=19$m=${String(ARGON2.memoryCost)},t=${String(ARGON2.timeCost)},p=${String(ARGON2.parallelism)}$`;

// Fail at load if ARGON2 changes but DUMMY_HASH is not regenerated: timing must match (S-16).
if (!DUMMY_HASH.startsWith(ARGON2_PARAM_PREFIX)) {
  throw new Error("DUMMY_HASH params differ from ARGON2; regenerate DUMMY_HASH.");
}

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2);
}

/** False for a wrong password or an unreadable hash; never throws. */
export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}
