import type { AlertRepo } from "@/data/access/repos/alerts";
import type { RepoDeps } from "../repoDeps";
import { notBuilt } from "../results";

/** Foundation stub: every method returns UNAVAILABLE until the owning task builds it. */
export class LocalAlertRepo implements AlertRepo {
  constructor(protected readonly deps: RepoDeps) {}

  readonly listAlerts: AlertRepo["listAlerts"] = () => notBuilt();
  readonly countOpen: AlertRepo["countOpen"] = () => notBuilt();
  readonly updateAlert: AlertRepo["updateAlert"] = () => notBuilt();
}
