import "server-only";
import { and, asc, count, eq, gte, isNull, lte, type SQL } from "drizzle-orm";
import type { AnalyticsFilters, AnalyticsRepo } from "@/data/access/repos/analytics";
import { ok } from "@/data/access/result";
import { previousPeriod } from "@/domain/metrics/filters";
import { computeOverview } from "@/domain/metrics/overview";
import { isMainAdmin } from "@/domain/roles";
import type { AnalyticsInput, JobCard, Visit } from "@/domain/types";
import { guard, type RequestCtx, type Scope } from "../ctx";
import { advisors, alerts, branches, jobCards, responses, visits } from "../db/schema";
import { branchFilter, requireAdmin, scopeOf } from "../scope";

type CardRow = typeof jobCards.$inferSelect;
type VisitRow = typeof visits.$inferSelect;
type Answers = AnalyticsInput["responses"][number]["response"]["answers"];

/** Only what the metrics need: no customer name, phone or registration number leaves the DB. */
function cardOf(c: CardRow): JobCard {
  return {
    jobCardNo: c.id,
    customerName: "",
    phone: null,
    regNo: "",
    model: c.model,
    vehicleType: c.vehicleType,
    serviceType: c.serviceType,
    serviceDate: c.serviceDate,
    advisorId: c.advisorId,
  };
}

function visitOf(v: VisitRow): Visit {
  return {
    id: v.id,
    jobCardNo: v.jobCardId,
    phone: null,
    token: "",
    createdBy: v.createdBy,
    createdAt: v.createdAt.toISOString(),
    expiresAt: v.expiresAt.toISOString(),
    openedAt: v.openedAt?.toISOString() ?? null,
    completedAt: v.completedAt?.toISOString() ?? null,
    cancelledAt: v.cancelledAt?.toISOString() ?? null,
    replacedBy: v.replacedBy,
  };
}

export class ServerAnalyticsRepo implements AnalyticsRepo {
  constructor(protected readonly ctx: RequestCtx) {}

  getAnalytics: AnalyticsRepo["getAnalytics"] = (f: AnalyticsFilters) =>
    guard(this.ctx, "analytics.getAnalytics", "read", async () => {
      const auth = requireAdmin(this.ctx);
      if (!auth.ok) return auth;
      const scope = scopeOf(auth.value.user);
      // Current and previous period, so the arrows can compare (S-11: by service date).
      const range = and(
        gte(jobCards.serviceDate, previousPeriod(f).from),
        lte(jobCards.serviceDate, f.to),
        branchFilter(jobCards.branchId, scope, f.branchId),
      );
      const [input, who] = await Promise.all([
        this.load(range, scope, f.branchId),
        this.advisorLabels(scope, f.branchId),
      ]);
      return ok(computeOverview(input, f, who.names, who.branches));
    });

  getFilterOptions: AnalyticsRepo["getFilterOptions"] = (f) =>
    guard(this.ctx, "analytics.getFilterOptions", "read", async () => {
      const auth = requireAdmin(this.ctx);
      if (!auth.ok) return auth;
      const { user } = auth.value;
      const scope = scopeOf(user);
      const advisorRows = await this.ctx.db
        .select()
        .from(advisors)
        .where(and(branchFilter(advisors.branchId, scope, f?.branchId), eq(advisors.active, true)))
        .orderBy(asc(advisors.name));
      const cards = await this.ctx.db
        .selectDistinct({ model: jobCards.model, vehicleType: jobCards.vehicleType })
        .from(jobCards)
        .where(branchFilter(jobCards.branchId, scope, f?.branchId));
      const base = {
        models: [...new Set(cards.map((c) => c.model))].sort((a, b) => a.localeCompare(b)),
        vehicleTypes: [...new Set(cards.map((c) => c.vehicleType))],
        advisors: advisorRows.map((a) => ({
          id: a.id,
          name: a.name,
          branchId: a.branchId,
          active: a.active,
        })),
      };
      if (!isMainAdmin(user.role)) return ok(base);
      const list = await this.ctx.db.select().from(branches).orderBy(asc(branches.name));
      const all = list.map((b) => ({
        id: b.id,
        name: b.name,
        city: b.city,
        active: b.active,
        createdAt: b.createdAt.toISOString(),
      }));
      return ok({ ...base, branches: all });
    });

  /** Advisor id to display name and to branch name, inside the caller's branch scope. */
  private async advisorLabels(
    scope: Scope,
    wanted?: string,
  ): Promise<{ names: Record<string, string>; branches: Record<string, string> }> {
    const rows = await this.ctx.db
      .select({ id: advisors.id, name: advisors.name, branch: branches.name })
      .from(advisors)
      .innerJoin(branches, eq(branches.id, advisors.branchId))
      .where(branchFilter(advisors.branchId, scope, wanted));
    return {
      names: Object.fromEntries(rows.map((r) => [r.id, r.name])),
      branches: Object.fromEntries(rows.map((r) => [r.id, r.branch])),
    };
  }

  /** Alerts of deleted responses are not open alerts (S-09). */
  private async countOpen(scope: Scope, wanted?: string): Promise<number> {
    const [open] = await this.ctx.db
      .select({ n: count() })
      .from(alerts)
      .innerJoin(responses, eq(responses.id, alerts.responseId))
      .where(
        and(
          isNull(responses.deletedAt),
          eq(alerts.status, "open"),
          branchFilter(alerts.branchId, scope, wanted),
        ),
      );
    return open?.n ?? 0;
  }

  private async load(
    range: SQL | undefined,
    scope: Scope,
    wanted?: string,
  ): Promise<AnalyticsInput> {
    const { db } = this.ctx;
    const visitRows = await db
      .select({ visit: visits, card: jobCards })
      .from(visits)
      .innerJoin(jobCards, eq(jobCards.id, visits.jobCardId))
      .where(range);
    const responseRows = await db
      .select({ response: responses, visit: visits, card: jobCards })
      .from(responses)
      .innerJoin(visits, eq(visits.id, responses.visitId))
      .innerJoin(jobCards, eq(jobCards.id, visits.jobCardId))
      .where(and(range, isNull(responses.deletedAt)));
    const openAlerts = await this.countOpen(scope, wanted);
    return {
      visits: visitRows.map((r) => ({ visit: visitOf(r.visit), jobCard: cardOf(r.card) })),
      responses: responseRows.map((r) => ({
        response: {
          id: r.response.id,
          visitId: r.response.visitId,
          questionsVersion: r.response.questionsVersion,
          submittedAt: r.response.submittedAt.toISOString(),
          answers: r.response.answers as Answers,
          deletedAt: null,
        },
        visit: visitOf(r.visit),
        jobCard: cardOf(r.card),
      })),
      openAlerts,
      now: this.ctx.clock.now(),
    };
  }
}
