import type { VisitRepo, VisitSummary } from "@/data/access/repos/visits";
import { err, ok, type Result } from "@/data/access/result";
import { env } from "@/config/env";
import { LINK_EXPIRY_DAYS } from "@/domain/constants";
import { normalizeJobCardNo } from "@/domain/jobCard";
import type { JobCard, User, Visit } from "@/domain/types";
import { buildWhatsAppUrl } from "@/domain/whatsapp";
import { visitStatus } from "@/domain/visitStatus";
import { newId } from "../ids";
import type { RepoDeps } from "../repoDeps";
import { guardRead, guardWrite } from "../results";
import { appendAudit } from "./auditWriter";
import { encodeToken } from "./token";

const MS_PER_DAY = 86_400_000;
const NOT_FOUND = "Link not found";
export const JOB_CARD_NOT_FOUND = "Job card not found. Check the number on the job card.";
const NOT_ALLOWED = "You can only change your own links";
export const SIGN_IN = "Sign in first";
const REPLACEABLE = new Set(["created", "opened", "expired"]);

function linkBase(): string {
  const fromEnv = env.NEXT_PUBLIC_APP_URL;
  if (fromEnv !== undefined && fromEnv !== "") return fromEnv.replace(/\/+$/, "");
  return typeof window === "undefined" ? "" : window.location.origin;
}

/** Pure mapper: a visit plus its job card as the support list/detail row. */
export function toVisitSummary(visit: Visit, jobCard: JobCard, now: Date, meId: string): VisitSummary {
  const url = `${linkBase()}/f/${visit.token}`;
  return {
    id: visit.id,
    jobCardNo: visit.jobCardNo,
    customerName: jobCard.customerName,
    regNo: jobCard.regNo,
    model: jobCard.model,
    serviceDate: jobCard.serviceDate,
    phone: visit.phone,
    status: visitStatus(visit, now),
    createdAt: visit.createdAt,
    expiresAt: visit.expiresAt,
    url,
    isMine: visit.createdBy === meId,
    whatsappUrl: buildWhatsAppUrl(visit.phone, {
      name: jobCard.customerName,
      model: jobCard.model,
      regNo: jobCard.regNo,
      url,
    }),
  };
}

/** Newest visit of a job card that is not replaced or cancelled, or null. */
export function currentVisitOf(visits: Visit[], jobCardNo: string): Visit | null {
  const live = visits
    .filter((v) => v.jobCardNo === jobCardNo && v.replacedBy === null && v.cancelledAt === null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return live[0] ?? null;
}

function newVisit(jobCardNo: string, phone: string | null, ownerId: string, now: Date): Visit {
  const base = {
    id: newId("v"),
    jobCardNo,
    phone,
    createdBy: ownerId,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + LINK_EXPIRY_DAYS * MS_PER_DAY).toISOString(),
    openedAt: null,
    completedAt: null,
    cancelledAt: null,
    replacedBy: null,
  };
  return { ...base, token: encodeToken(base) };
}

function cleanPhone(phone: string | null): string | null {
  const trimmed = phone?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}

function matches(s: VisitSummary, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (q === "") return true;
  const compact = q.replace(/\s+/g, "");
  return (
    normalizeJobCardNo(s.jobCardNo).toLowerCase().includes(normalizeJobCardNo(q).toLowerCase()) ||
    s.regNo.replace(/\s+/g, "").toLowerCase().includes(compact)
  );
}

export class LocalVisitRepo implements VisitRepo {
  constructor(protected readonly deps: RepoDeps) {}

  readonly listMyVisits: VisitRepo["listMyVisits"] = (q) =>
    guardRead(async () => {
      await this.deps.store.whenReady();
      const me = this.deps.session.current();
      if (me === null) return err("UNAUTHENTICATED", SIGN_IN);
      const now = this.deps.clock.now();
      const cards = new Map(this.deps.store.read("jobCards").map((j) => [j.jobCardNo, j]));
      const rows = this.deps.store
        .read("visits")
        .filter((v) => v.createdBy === me.id && v.replacedBy === null)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .flatMap((v) => {
          const card = cards.get(v.jobCardNo);
          return card === undefined ? [] : [toVisitSummary(v, card, now, me.id)];
        });
      return ok(q?.search === undefined ? rows : rows.filter((r) => matches(r, q.search ?? "")));
    });

  readonly createVisitLink: VisitRepo["createVisitLink"] = (i) =>
    guardWrite(async () => {
      const me = this.deps.session.current();
      if (me === null) return err("UNAUTHENTICATED", SIGN_IN);
      const now = this.deps.clock.now();
      return this.deps.store.mutate(["visits", "jobCards", "audit"], (d): Result<VisitSummary> => {
        const wanted = normalizeJobCardNo(i.jobCardNo);
        const card = d.jobCards.find((j) => normalizeJobCardNo(j.jobCardNo) === wanted);
        if (card === undefined) return err("NOT_FOUND", JOB_CARD_NOT_FOUND);
        if (d.visits.some((v) => v.jobCardNo === card.jobCardNo && v.completedAt !== null)) {
          return err("ALREADY_COMPLETED", "Feedback already received");
        }
        if (currentVisitOf(d.visits, card.jobCardNo) !== null) {
          return err("CONFLICT", "A link already exists for this job card");
        }
        const visit = newVisit(card.jobCardNo, cleanPhone(i.phone), me.id, now);
        d.visits.push(visit);
        appendAudit(
          d,
          {
            actorId: me.id,
            actorName: me.name,
            action: "link.create",
            entityType: "visit",
            entityId: visit.id,
            oldValue: null,
            newValue: { jobCardNo: visit.jobCardNo, phone: visit.phone },
          },
          now,
        );
        return ok(toVisitSummary(visit, card, now, me.id));
      });
    });

  readonly regenerateLink: VisitRepo["regenerateLink"] = (visitId) =>
    this.changeLink(visitId, (d, old, card, me, now) => {
      const visit = newVisit(old.jobCardNo, old.phone, old.createdBy, now);
      d.visits.push(visit);
      old.replacedBy = visit.id;
      this.audit(d, { me, now }, "link.regenerate", {
        id: old.id,
        oldValue: { replacedBy: null },
        newValue: { replacedBy: visit.id },
      });
      return toVisitSummary(visit, card, now, me.id);
    });

  readonly cancelLink: VisitRepo["cancelLink"] = (visitId) =>
    this.changeLink(visitId, (d, old, card, me, now) => {
      old.cancelledAt = now.toISOString();
      this.audit(d, { me, now }, "link.cancel", {
        id: old.id,
        oldValue: { cancelledAt: null },
        newValue: { cancelledAt: old.cancelledAt },
      });
      return toVisitSummary(old, card, now, me.id);
    });

  private audit(
    d: { audit: Parameters<typeof appendAudit>[0]["audit"] },
    ctx: { me: User; now: Date },
    action: "link.regenerate" | "link.cancel",
    entity: { id: string; oldValue: unknown; newValue: unknown },
  ): void {
    const { me, now } = ctx;
    appendAudit(
      d,
      { actorId: me.id, actorName: me.name, action, entityType: "visit", entityId: entity.id, ...entity },
      now,
    );
  }

  /** Shared guard for regenerate/cancel: signed in, own link, still replaceable. */
  private changeLink(
    visitId: string,
    apply: (
      d: { visits: Visit[]; audit: Parameters<typeof appendAudit>[0]["audit"] },
      old: Visit,
      card: JobCard,
      me: User,
      now: Date,
    ) => VisitSummary,
  ): Promise<Result<VisitSummary>> {
    return guardWrite(async () => {
      const me = this.deps.session.current();
      if (me === null) return err("UNAUTHENTICATED", SIGN_IN);
      const now = this.deps.clock.now();
      return this.deps.store.mutate(["visits", "jobCards", "audit"], (d): Result<VisitSummary> => {
        const old = d.visits.find((v) => v.id === visitId);
        const card = d.jobCards.find((j) => j.jobCardNo === old?.jobCardNo);
        if (old === undefined || card === undefined) return err("NOT_FOUND", NOT_FOUND);
        if (me.role !== "admin" && old.createdBy !== me.id) return err("FORBIDDEN", NOT_ALLOWED);
        if (old.replacedBy !== null || !REPLACEABLE.has(visitStatus(old, now))) {
          return err("CONFLICT", "This link can no longer be changed");
        }
        return ok(apply(d, old, card, me, now));
      });
    });
  }
}
