import type { DataAccess } from "@/data/access";
import { env } from "@/config/env";
import seedJson from "@/data/seed/seed.json";
import { SeedSchema } from "@/domain/schemas";
import { ChangeBus } from "./bus";
import type { Clock } from "./db";
import { FaultSwitch } from "./fault";
import { LocalAlertRepo } from "./repos/alerts";
import { LocalAnalyticsRepo } from "./repos/analytics";
import { LocalAuditRepo } from "./repos/audit";
import { LocalAuthRepo } from "./repos/auth";
import { LocalDemoRepo } from "./repos/demo";
import { LocalFeedbackRepo } from "./repos/feedback";
import { LocalJobCardRepo } from "./repos/jobCards";
import { LocalResponseRepo } from "./repos/responses";
import { LocalUserRepo } from "./repos/users";
import { LocalVisitRepo } from "./repos/visits";
import { rebaseSeed } from "./seed";
import { StoreSessionReader } from "./session";
import { LocalStore } from "./store";

export interface LocalDataAccessDeps {
  storage: Storage;
  locks: LockManager | null;
  clock: Clock;
  win: Window;
}

/** Composition root of the phase-1 data layer; the only place that wires storage, locks and repos. */
export function createLocalDataAccess(deps: LocalDataAccessDeps): DataAccess {
  const bus = new ChangeBus();
  const fault = new FaultSwitch(deps.win.sessionStorage);
  fault.armFromSearch(deps.win.location.search);
  const seeder = (now: Date) => rebaseSeed(SeedSchema.parse(seedJson), now, env.NEXT_PUBLIC_DEMO_PASSWORD);
  const store = new LocalStore({ ...deps, bus, fault, seeder });
  const repoDeps = { store, clock: deps.clock, session: new StoreSessionReader(store) };
  store.whenReady().catch(() => undefined);
  return {
    auth: new LocalAuthRepo(repoDeps),
    demo: new LocalDemoRepo(repoDeps),
    jobCards: new LocalJobCardRepo(repoDeps),
    visits: new LocalVisitRepo(repoDeps),
    feedback: new LocalFeedbackRepo(repoDeps),
    analytics: new LocalAnalyticsRepo(repoDeps),
    alerts: new LocalAlertRepo(repoDeps),
    responses: new LocalResponseRepo(repoDeps),
    audit: new LocalAuditRepo(repoDeps),
    users: new LocalUserRepo(repoDeps),
    subscribe: (listener) => bus.on(listener),
  };
}
