import "server-only";
import type { VisitRepo } from "@/data/access";
import type { RequestCtx } from "../ctx";
import { unavailable } from "./unavailable";

export class ServerVisitRepo implements VisitRepo {
  constructor(protected readonly ctx: RequestCtx) {}
  listMyVisits: VisitRepo["listMyVisits"] = () => unavailable();
  createVisitLink: VisitRepo["createVisitLink"] = () => unavailable();
  regenerateLink: VisitRepo["regenerateLink"] = () => unavailable();
  cancelLink: VisitRepo["cancelLink"] = () => unavailable();
}
