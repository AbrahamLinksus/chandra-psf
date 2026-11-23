import "server-only";
import type { AnalyticsRepo } from "@/data/access";
import type { RequestCtx } from "../ctx";
import { unavailable } from "./unavailable";

export class ServerAnalyticsRepo implements AnalyticsRepo {
  constructor(protected readonly ctx: RequestCtx) {}
  getAnalytics: AnalyticsRepo["getAnalytics"] = () => unavailable();
  getFilterOptions: AnalyticsRepo["getFilterOptions"] = () => unavailable();
}
