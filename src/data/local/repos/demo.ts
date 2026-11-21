import type { DemoRepo } from "@/data/access/repos/demo";
import { ok } from "@/data/access/result";
import type { RepoDeps } from "../repoDeps";
import { guardWrite } from "../results";

export class LocalDemoRepo implements DemoRepo {
  constructor(protected readonly deps: RepoDeps) {}

  /** Wipes every `psf:` key and reseeds from today; the session key goes too, so every tab signs out (US-22). */
  readonly resetDemoData: DemoRepo["resetDemoData"] = () =>
    guardWrite(async () => {
      await this.deps.store.wipeAndReseed(this.deps.clock.now());
      return ok(undefined);
    });

  /** S-13: the next write in this tab fails once. */
  readonly armFailedSave: DemoRepo["armFailedSave"] = () => {
    this.deps.store.fault.armNextWrite();
    return Promise.resolve(ok(undefined));
  };
}
