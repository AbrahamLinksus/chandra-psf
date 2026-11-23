import "server-only";
import type { BranchRepo } from "@/data/access";
import type { RequestCtx } from "../ctx";
import { unavailable } from "./unavailable";

/** Stub until the feature task that owns this repo lands (LLD-phase2 §23/§24). */
export class ServerBranchRepo implements BranchRepo {
  constructor(protected readonly ctx: RequestCtx) {}
  listBranches: BranchRepo["listBranches"] = () => unavailable();
  createBranch: BranchRepo["createBranch"] = () => unavailable();
  updateBranch: BranchRepo["updateBranch"] = () => unavailable();
  setBranchActive: BranchRepo["setBranchActive"] = () => unavailable();
}
