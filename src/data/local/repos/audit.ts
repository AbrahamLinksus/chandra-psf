import type { AuditRepo } from "@/data/access/repos/audit";
import { err, ok } from "@/data/access/result";
import type { RepoDeps } from "../repoDeps";
import { guardRead } from "../results";

/** Read side of the audit log; writes go only through `appendAudit` (auditWriter.ts). */
export class LocalAuditRepo implements AuditRepo {
  constructor(protected readonly deps: RepoDeps) {}

  readonly listAudit: AuditRepo["listAudit"] = (f) =>
    guardRead(async () => {
      await this.deps.store.whenReady();
      const me = this.deps.session.current();
      if (me === null) return err("UNAUTHENTICATED", "Sign in first");
      if (me.role !== "admin") return err("FORBIDDEN", "Only an admin can view the audit log");
      const rows = this.deps.store
        .read("audit")
        .filter((e) => f?.action === undefined || e.action === f.action)
        .sort((a, b) => b.at.localeCompare(a.at));
      return ok(rows);
    });
}
