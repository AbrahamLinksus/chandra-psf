import "server-only";
import type { AuditRepo } from "@/data/access";
import type { RequestCtx } from "../ctx";
import { unavailable } from "./unavailable";

export class ServerAuditRepo implements AuditRepo {
  constructor(protected readonly ctx: RequestCtx) {}
  listAudit: AuditRepo["listAudit"] = () => unavailable();
}
