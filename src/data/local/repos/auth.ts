import type { AuthRepo } from "@/data/access/repos/auth";
import { ok } from "@/data/access/result";
import type { RepoDeps } from "../repoDeps";
import { guardRead, notBuilt } from "../results";

/**
 * Foundation: `currentUser` is real (RoleGuard needs it); the other methods return UNAVAILABLE
 * until T-02 builds them.
 */
export class LocalAuthRepo implements AuthRepo {
  constructor(protected readonly deps: RepoDeps) {}

  readonly signIn: AuthRepo["signIn"] = () => notBuilt();
  readonly signInAsDemo: AuthRepo["signInAsDemo"] = () => notBuilt();
  readonly setOwnPassword: AuthRepo["setOwnPassword"] = () => notBuilt();
  readonly signOut: AuthRepo["signOut"] = () => notBuilt();

  readonly currentUser: AuthRepo["currentUser"] = () =>
    guardRead(async () => {
      await this.deps.store.whenReady();
      return ok(this.deps.session.current());
    });
}
