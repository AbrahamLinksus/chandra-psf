import type { AuditRepo } from "@/data/access/repos/audit";
import type { RepoDeps } from "../repoDeps";
import { notBuilt } from "../results";

/** Foundation stub: every method returns UNAVAILABLE until the owning task builds it. */
export class LocalAuditRepo implements AuditRepo {
  constructor(protected readonly deps: RepoDeps) {}

  readonly listAudit: AuditRepo["listAudit"] = () => notBuilt();
}
