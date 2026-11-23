import "server-only";
import type { JobCardRepo } from "@/data/access";
import type { RequestCtx } from "../ctx";
import { unavailable } from "./unavailable";

export class ServerJobCardRepo implements JobCardRepo {
  constructor(protected readonly ctx: RequestCtx) {}
  getJobCard: JobCardRepo["getJobCard"] = () => unavailable();
  listFreshJobCards: JobCardRepo["listFreshJobCards"] = () => unavailable();
}
