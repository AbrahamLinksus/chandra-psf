import type { DemoRepo } from "@/data/access/repos/demo";
import type { RepoDeps } from "../repoDeps";
import { notBuilt } from "../results";

/** Foundation stub: every method returns UNAVAILABLE until the owning task builds it. */
export class LocalDemoRepo implements DemoRepo {
  constructor(protected readonly deps: RepoDeps) {}

  readonly resetDemoData: DemoRepo["resetDemoData"] = () => notBuilt();
  readonly armFailedSave: DemoRepo["armFailedSave"] = () => notBuilt();
}
