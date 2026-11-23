import type { User } from "@/domain/types";
import type { Result } from "../result";

export interface AuthRepo {
  /** BAD_CREDENTIALS, ACCOUNT_DISABLED, OTP_EXPIRED, RATE_LIMITED ("Too many attempts. Try again in 15 minutes.") */
  signIn(email: string, password: string): Promise<Result<User>>;
  /** VALIDATION (< 8 chars); audit user.set_password */
  setOwnPassword(newPassword: string): Promise<Result<User>>;
  /**
   * Own password, from My account. VALIDATION (weak new password, fields ["password"]);
   * BAD_PASSWORD "Password incorrect" (wrong current); UNAUTHENTICATED after 5 wrong in 15 min (sessions ended).
   * Success ends the other sessions; audit user.change_password.
   */
  changePassword(currentPassword: string, newPassword: string): Promise<Result<void>>;
  signOut(): Promise<Result<void>>;
  /** The signed-in user (name, email, role, branchName) for My account; null when signed out. */
  currentUser(): Promise<Result<User | null>>;
}
