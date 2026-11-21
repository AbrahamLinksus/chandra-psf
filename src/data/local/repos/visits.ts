import type { VisitRepo } from "@/data/access/repos/visits";
import type { RepoDeps } from "../repoDeps";
import { notBuilt } from "../results";

/** Foundation stub: every method returns UNAVAILABLE until the owning task builds it. */
export class LocalVisitRepo implements VisitRepo {
  constructor(protected readonly deps: RepoDeps) {}

  readonly listMyVisits: VisitRepo["listMyVisits"] = () => notBuilt();
  readonly createVisitLink: VisitRepo["createVisitLink"] = () => notBuilt();
  readonly regenerateLink: VisitRepo["regenerateLink"] = () => notBuilt();
  readonly cancelLink: VisitRepo["cancelLink"] = () => notBuilt();
}
