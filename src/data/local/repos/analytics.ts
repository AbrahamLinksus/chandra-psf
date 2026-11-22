import type { AnalyticsRepo, FilterOptions } from "@/data/access/repos/analytics";
import { err, ok, type Result } from "@/data/access/result";
import { computeOverview } from "@/domain/metrics/overview";
import type { AnalyticsInput, Filters, JobCard, OverviewData } from "@/domain/types";
import type { RepoDeps } from "../repoDeps";
import { guardRead } from "../results";

const SIGN_IN = "Sign in first";
const NOT_ALLOWED = "Not allowed";
const BAD_RANGE = "The start date must not be after the end date";

export class LocalAnalyticsRepo implements AnalyticsRepo {
  constructor(protected readonly deps: RepoDeps) {}

  /** Role check shared by every method: null when the caller is an active admin. */
  private denied(): Result<never> | null {
    const me = this.deps.session.current();
    if (me === null) return err("UNAUTHENTICATED", SIGN_IN);
    return me.role === "admin" ? null : err("FORBIDDEN", NOT_ALLOWED);
  }

  /** Joins store collections into the pure metrics input; deleted responses are left out (S-09). */
  private buildInput(): AnalyticsInput {
    const { store, clock } = this.deps;
    const cards = new Map<string, JobCard>(store.read("jobCards").map((c) => [c.jobCardNo, c]));
    const visits = store.read("visits").flatMap((visit) => {
      const jobCard = cards.get(visit.jobCardNo);
      return jobCard === undefined ? [] : [{ visit, jobCard }];
    });
    const byId = new Map(visits.map((v) => [v.visit.id, v]));
    const responses = store.read("responses").flatMap((response) => {
      const v = response.deletedAt === null ? byId.get(response.visitId) : undefined;
      return v === undefined ? [] : [{ response, ...v }];
    });
    // Same rule as the alerts queue: an alert is live only if its response is live and joined.
    const liveIds = new Set(responses.map((r) => r.response.id));
    const openAlerts = store.read("alerts").filter((a) => a.status === "open" && liveIds.has(a.responseId)).length;
    return { visits, responses, openAlerts, now: clock.now() };
  }

  readonly getAnalytics = (f: Filters): Promise<Result<OverviewData>> =>
    guardRead(() => {
      const denied = this.denied();
      if (denied !== null) return Promise.resolve(denied);
      if (f.from > f.to) return Promise.resolve(err("VALIDATION", BAD_RANGE, ["from", "to"]));
      const names = Object.fromEntries(this.deps.store.read("advisors").map((a) => [a.id, a.name]));
      return Promise.resolve(ok(computeOverview(this.buildInput(), f, names)));
    });

  readonly getFilterOptions = (): Promise<Result<FilterOptions>> =>
    guardRead(() => {
      const denied = this.denied();
      if (denied !== null) return Promise.resolve(denied);
      const { store } = this.deps;
      const cards = store.read("jobCards");
      const models = [...new Set(cards.map((c) => c.model))].sort((a, b) => a.localeCompare(b));
      const vehicleTypes = [...new Set(cards.map((c) => c.vehicleType))].sort();
      return Promise.resolve(ok({ models, advisors: store.read("advisors"), vehicleTypes }));
    });
}
