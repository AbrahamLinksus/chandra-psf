import type { UserRepo } from "@/data/access/repos/users";
import type { RepoDeps } from "../repoDeps";
import { notBuilt } from "../results";

/** Foundation stub: every method returns UNAVAILABLE until the owning task builds it. */
export class LocalUserRepo implements UserRepo {
  constructor(protected readonly deps: RepoDeps) {}

  readonly listUsers: UserRepo["listUsers"] = () => notBuilt();
  readonly createSupportUser: UserRepo["createSupportUser"] = () => notBuilt();
  readonly setUserActive: UserRepo["setUserActive"] = () => notBuilt();
}
