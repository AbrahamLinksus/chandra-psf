import "server-only";
import type { DataAccess } from "@/data/access";
import type { RequestCtx } from "./ctx";
import { ServerAdvisorRepo } from "./repos/advisors";
import { ServerAlertRepo } from "./repos/alerts";
import { ServerAnalyticsRepo } from "./repos/analytics";
import { ServerAuditRepo } from "./repos/audit";
import { ServerAuthRepo } from "./repos/auth";
import { ServerBranchRepo } from "./repos/branches";
import { ServerCustomerRepo } from "./repos/customers";
import { ServerFeedbackRepo } from "./repos/feedback";
import { ServerJobCardRepo } from "./repos/jobCards";
import { ServerResponseRepo } from "./repos/responses";
import { ServerUserRepo } from "./repos/users";
import { ServerVisitRepo } from "./repos/visits";

/** Server composition root: the only importer of `src/server/repos`. `subscribe` does not exist on the server. */
export function createServerDataAccess(ctx: RequestCtx): Omit<DataAccess, "subscribe"> {
  return {
    auth: new ServerAuthRepo(ctx),
    jobCards: new ServerJobCardRepo(ctx),
    visits: new ServerVisitRepo(ctx),
    feedback: new ServerFeedbackRepo(ctx),
    analytics: new ServerAnalyticsRepo(ctx),
    alerts: new ServerAlertRepo(ctx),
    responses: new ServerResponseRepo(ctx),
    audit: new ServerAuditRepo(ctx),
    users: new ServerUserRepo(ctx),
    branches: new ServerBranchRepo(ctx),
    advisors: new ServerAdvisorRepo(ctx),
    customers: new ServerCustomerRepo(ctx),
  };
}
