import "server-only";
import type { ResponseRepo } from "@/data/access";
import type { RequestCtx } from "../ctx";
import { unavailable } from "./unavailable";

export class ServerResponseRepo implements ResponseRepo {
  constructor(protected readonly ctx: RequestCtx) {}
  listResponses: ResponseRepo["listResponses"] = () => unavailable();
  getResponse: ResponseRepo["getResponse"] = () => unavailable();
  editResponse: ResponseRepo["editResponse"] = () => unavailable();
  deleteResponse: ResponseRepo["deleteResponse"] = () => unavailable();
  restoreResponse: ResponseRepo["restoreResponse"] = () => unavailable();
  listDeleted: ResponseRepo["listDeleted"] = () => unavailable();
}
