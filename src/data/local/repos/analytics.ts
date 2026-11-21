import type { AnalyticsRepo } from "@/data/access/repos/analytics";
import type { RepoDeps } from "../repoDeps";
import { notBuilt } from "../results";

/** Foundation stub: every method returns UNAVAILABLE until the owning task builds it. */
export class LocalAnalyticsRepo implements AnalyticsRepo {
  constructor(protected readonly deps: RepoDeps) {}

  readonly getAnalytics: AnalyticsRepo["getAnalytics"] = () => notBuilt();
  readonly getFilterOptions: AnalyticsRepo["getFilterOptions"] = () => notBuilt();
}
