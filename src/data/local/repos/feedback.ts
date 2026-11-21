import type { FeedbackRepo } from "@/data/access/repos/feedback";
import type { RepoDeps } from "../repoDeps";
import { notBuilt } from "../results";

/** Foundation stub: every method returns UNAVAILABLE until the owning task builds it. */
export class LocalFeedbackRepo implements FeedbackRepo {
  constructor(protected readonly deps: RepoDeps) {}

  readonly getVisitByToken: FeedbackRepo["getVisitByToken"] = () => notBuilt();
  readonly markOpened: FeedbackRepo["markOpened"] = () => notBuilt();
  readonly submitResponse: FeedbackRepo["submitResponse"] = () => notBuilt();
}
