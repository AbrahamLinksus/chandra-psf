import type { User } from "@/domain/types";
import type { Result } from "../result";

export interface AuthRepo {
  /** BAD_CREDENTIALS, ACCOUNT_DISABLED */
  signIn(email: string, password: string): Promise<Result<User>>;
  signInAsDemo(who: "admin" | "support1" | "support2"): Promise<Result<User>>;
  /** VALIDATION (< 8 chars); audit user.set_password */
  setOwnPassword(newPassword: string): Promise<Result<User>>;
  signOut(): Promise<Result<void>>;
  currentUser(): Promise<Result<User | null>>;
}
