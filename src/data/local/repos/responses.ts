import type { ResponseRepo } from "@/data/access/repos/responses";
import type { RepoDeps } from "../repoDeps";
import { notBuilt } from "../results";

/** Foundation stub: every method returns UNAVAILABLE until the owning task builds it. */
export class LocalResponseRepo implements ResponseRepo {
  constructor(protected readonly deps: RepoDeps) {}

  readonly listResponses: ResponseRepo["listResponses"] = () => notBuilt();
  readonly getResponse: ResponseRepo["getResponse"] = () => notBuilt();
  readonly editResponse: ResponseRepo["editResponse"] = () => notBuilt();
  readonly deleteResponse: ResponseRepo["deleteResponse"] = () => notBuilt();
  readonly restoreResponse: ResponseRepo["restoreResponse"] = () => notBuilt();
  readonly listDeleted: ResponseRepo["listDeleted"] = () => notBuilt();
}
