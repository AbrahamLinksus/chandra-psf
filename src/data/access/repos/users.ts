import type { Role, User } from "@/domain/types";
import type { Result } from "../result";

export interface UserRepo {
  /** Admins only; a branch admin gets own branch whatever `branchId` says. */
  listUsers(f?: { branchId?: string }): Promise<Result<User[]>>;
  /**
   * EMAIL_IN_USE (case-insensitive), VALIDATION ("Add a branch first" when no branch exists),
   * FORBIDDEN (role/branch outside the caller's rights); mustSetPassword = true; audit user.create
   */
  createUser(i: {
    name: string;
    email: string;
    role: Role;
    branchId: string | null;
    tempPassword: string;
  }): Promise<Result<User>>;
  /** G-9 rights; role/branch change ends the user's sessions; NOT_FOUND outside scope; audit user.update old → new */
  updateUser(
    id: string,
    p: { name?: string; email?: string; role?: Role; branchId?: string | null },
  ): Promise<Result<User>>;
  /** FORBIDDEN on self; CONFLICT for the last active main admin; deactivation ends sessions */
  setUserActive(id: string, active: boolean): Promise<Result<User>>;
  /** Temp password: must_set_password, sessions end, sign-in lock cleared; audit without the password */
  resetPassword(id: string, tempPassword: string): Promise<Result<void>>;
}
