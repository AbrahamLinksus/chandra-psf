import type { JobCardRepo } from "@/data/access/repos/jobCards";
import type { RepoDeps } from "../repoDeps";
import { notBuilt } from "../results";

/** Foundation stub: every method returns UNAVAILABLE until the owning task builds it. */
export class LocalJobCardRepo implements JobCardRepo {
  constructor(protected readonly deps: RepoDeps) {}

  readonly getJobCard: JobCardRepo["getJobCard"] = () => notBuilt();
  readonly listFreshJobCards: JobCardRepo["listFreshJobCards"] = () => notBuilt();
}
