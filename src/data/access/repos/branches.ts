import type { Branch } from "@/domain/types";
import type { Result } from "../result";

export type BranchWithCount = Branch & { staffCount: number };

export interface BranchRepo {
  listBranches(): Promise<Result<BranchWithCount[]>>;
  /** NAME_IN_USE; main admin only */
  createBranch(i: { name: string; city: string }): Promise<Result<Branch>>;
  /** NAME_IN_USE; main admin only */
  updateBranch(id: string, p: { name?: string; city?: string }): Promise<Result<Branch>>;
  /** main admin only; deactivating ends the branch staff's sessions */
  setBranchActive(id: string, active: boolean): Promise<Result<Branch>>;
}
