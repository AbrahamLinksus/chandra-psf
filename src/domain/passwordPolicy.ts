import { COMMON_PASSWORDS } from "./commonPasswords";
import { MIN_PASSWORD_LENGTH } from "./constants";

export type PasswordProblem = "too_short" | "too_common";

/** Why a password is unacceptable (US-28), or null when it passes. Case-insensitive list match. */
export function passwordProblem(pw: string): PasswordProblem | null {
  if (pw.length < MIN_PASSWORD_LENGTH) return "too_short";
  if (COMMON_PASSWORDS.has(pw.toLowerCase())) return "too_common";
  return null;
}
