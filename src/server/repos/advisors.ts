import "server-only";
import type { AdvisorRepo } from "@/data/access";
import type { RequestCtx } from "../ctx";
import { unavailable } from "./unavailable";

/** Stub until the feature task that owns this repo lands (LLD-phase2 §23/§24). */
export class ServerAdvisorRepo implements AdvisorRepo {
  constructor(protected readonly ctx: RequestCtx) {}
  listAdvisors: AdvisorRepo["listAdvisors"] = () => unavailable();
  createAdvisor: AdvisorRepo["createAdvisor"] = () => unavailable();
  renameAdvisor: AdvisorRepo["renameAdvisor"] = () => unavailable();
  setAdvisorActive: AdvisorRepo["setAdvisorActive"] = () => unavailable();
}
