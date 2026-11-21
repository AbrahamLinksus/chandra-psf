import type { User } from "@/domain/types";
import type { Result } from "../result";

export interface UserRepo {
  listUsers(): Promise<Result<User[]>>;
  /** EMAIL_IN_USE (case-insensitive), VALIDATION; mustSetPassword = true; audit user.create */
  createSupportUser(i: { name: string; email: string; tempPassword: string }): Promise<Result<User>>;
  /** FORBIDDEN on self; audit user.deactivate / user.reactivate */
  setUserActive(id: string, active: boolean): Promise<Result<User>>;
}
