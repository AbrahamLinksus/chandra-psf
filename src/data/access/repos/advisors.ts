import type { Advisor } from "@/domain/types";
import type { Result } from "../result";

export type AdvisorWithBranch = Advisor & { branchName: string };

export interface AdvisorRepo {
  listAdvisors(f: { branchId?: string; activeOnly?: boolean }): Promise<Result<AdvisorWithBranch[]>>;
  createAdvisor(i: { branchId: string; name: string }): Promise<Result<Advisor>>;
  renameAdvisor(id: string, name: string): Promise<Result<Advisor>>;
  setAdvisorActive(id: string, active: boolean): Promise<Result<Advisor>>;
}
