import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { getServerEnv } from "./env";

const CODE_BYTES = 32;
const DEV_ORIGIN = "http://localhost:3000";

/** A fresh link code (43 chars, base64url of 32 random bytes) and the SHA-256 the database keeps. */
export function newLinkCode(): { code: string; hash: Buffer } {
  const code = randomBytes(CODE_BYTES).toString("base64url");
  return { code, hash: hashCode(code) };
}

export function hashCode(code: string): Buffer {
  return createHash("sha256").update(code).digest();
}

/** `APP_URL/f/<code>`; without APP_URL (dev, tests) falls back to localhost. */
export function linkUrl(code: string): string {
  const base = (getServerEnv().APP_URL ?? DEV_ORIGIN).replace(/\/+$/, "");
  return `${base}/f/${code}`;
}
