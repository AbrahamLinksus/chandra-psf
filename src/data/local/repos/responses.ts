import type {
  DeletedRow,
  ResponseDetail,
  ResponseListRow,
  ResponseRepo,
} from "@/data/access/repos/responses";
import { err, ok, type Result, type StepUp } from "@/data/access/result";
import { evaluateAlertReasons, reconcileAlert, type AlertChange } from "@/domain/alertRules";
import { validateSubmission } from "@/domain/visibility";
import { QUESTIONNAIRE_V1 } from "@/domain/questionnaire";
import type {
  Alert,
  AnswerMap,
  AuditEntry,
  Filters,
  JobCard,
  QuestionCode,
  ResponseRecord,
  User,
  Visit,
} from "@/domain/types";
import { hashPassword } from "../crypto";
import type { Db } from "../db";
import { newId } from "../ids";
import type { RepoDeps } from "../repoDeps";
import { guardRead, guardWrite } from "../results";
import { appendAudit } from "./auditWriter";
import { toVisitSummary } from "./visits";

const SIGN_IN = "Sign in first";
const ADMIN_ONLY = "Only an admin can use responses";
const NOT_FOUND = "Response not found";
const BAD_PASSWORD = "Password incorrect";
const WRITE_KEYS = ["responses", "alerts", "visits", "jobCards", "advisors", "users", "audit"] as const;

type Source = Pick<Db, "responses" | "alerts" | "visits" | "jobCards" | "advisors">;
type Draft = Pick<Db, (typeof WRITE_KEYS)[number]>;
interface Joined {
  response: ResponseRecord;
  visit: Visit;
  card: JobCard;
}
interface AuditInput {
  action: AuditEntry["action"];
  id: string;
  oldValue: unknown;
  newValue: unknown;
  note?: string;
}

function join(response: ResponseRecord, src: Pick<Db, "visits" | "jobCards">): Joined | null {
  const visit = src.visits.find((v) => v.id === response.visitId);
  const card = visit && src.jobCards.find((j) => j.jobCardNo === visit.jobCardNo);
  return visit === undefined || card === undefined ? null : { response, visit, card };
}

function matchesFilters(card: JobCard, f: Filters): boolean {
  return (
    card.serviceDate >= f.from &&
    card.serviceDate <= f.to &&
    (f.vehicleType === undefined || card.vehicleType === f.vehicleType) &&
    (f.model === undefined || card.model === f.model) &&
    (f.advisorId === undefined || card.advisorId === f.advisorId)
  );
}

function advisorName(src: Pick<Db, "advisors">, id: string): string {
  return src.advisors.find((a) => a.id === id)?.name ?? "";
}

/** Old and new values of the changed codes only. */
function diffAnswers(before: AnswerMap, after: AnswerMap): { oldValue: AnswerMap; newValue: AnswerMap } {
  const oldValue: AnswerMap = {};
  const newValue: AnswerMap = {};
  for (const q of QUESTIONNAIRE_V1.questions) {
    const code: QuestionCode = q.code;
    if (JSON.stringify(before[code]) === JSON.stringify(after[code])) continue;
    if (before[code] !== undefined) oldValue[code] = before[code];
    if (after[code] !== undefined) newValue[code] = after[code];
  }
  return { oldValue, newValue };
}

function toRow({ response, card }: Joined, src: Source): ResponseListRow {
  const q12 = response.answers.Q12;
  return {
    id: response.id,
    serviceDate: card.serviceDate,
    customerName: card.customerName,
    model: card.model,
    advisorName: advisorName(src, card.advisorId),
    q12: typeof q12 === "number" ? q12 : 0,
    hasAlert: src.alerts.some((a) => a.responseId === response.id && a.status === "open"),
  };
}

function toDeletedRow(r: ResponseRecord, src: Source): DeletedRow[] {
  const j = join(r, src);
  if (j === null || r.deletedAt === null) return [];
  const { customerName, serviceDate } = j.card;
  return [{ id: r.id, customerName, serviceDate, deletedAt: r.deletedAt }];
}

export class LocalResponseRepo implements ResponseRepo {
  constructor(protected readonly deps: RepoDeps) {}

  /** Signed-in admin, or the error result to return. */
  private admin(): User | Result<never> {
    const me = this.deps.session.current();
    if (me === null) return err("UNAUTHENTICATED", SIGN_IN);
    return me.role === "admin" ? me : err("FORBIDDEN", ADMIN_ONLY);
  }

  private source(): Source {
    const { store } = this.deps;
    return {
      responses: store.read("responses"),
      alerts: store.read("alerts"),
      visits: store.read("visits"),
      jobCards: store.read("jobCards"),
      advisors: store.read("advisors"),
    };
  }

  private detail(id: string, src: Source, me: User): Result<ResponseDetail> {
    const response = src.responses.find((r) => r.id === id);
    const joined = response && join(response, src);
    if (response?.deletedAt !== null || joined === null || joined === undefined) {
      return err("NOT_FOUND", NOT_FOUND);
    }
    const { visit, card } = joined;
    return ok({
      response,
      visit: toVisitSummary(visit, card, this.deps.clock.now(), me.id),
      jobCard: { ...card, advisorName: advisorName(src, card.advisorId) },
      questionnaire: QUESTIONNAIRE_V1,
      alert: src.alerts.find((a) => a.responseId === id) ?? null,
    });
  }

  /** Reads as an admin: waits for the store, checks the role, then runs `fn`. */
  private read<T>(fn: (src: Source, me: User) => Result<T>): Promise<Result<T>> {
    return guardRead(async () => {
      await this.deps.store.whenReady();
      const me = this.admin();
      return "ok" in me ? me : fn(this.source(), me);
    });
  }

  readonly listResponses: ResponseRepo["listResponses"] = (f) =>
    this.read((src) => {
      const rows = src.responses
        .filter((r) => r.deletedAt === null)
        .flatMap((r) => join(r, src) ?? [])
        .filter((j) => matchesFilters(j.card, f))
        .sort((a, b) => b.response.submittedAt.localeCompare(a.response.submittedAt))
        .map((j) => toRow(j, src));
      return ok(rows);
    });

  readonly getResponse: ResponseRepo["getResponse"] = (id) =>
    this.read((src, me) => this.detail(id, src, me));

  readonly listDeleted: ResponseRepo["listDeleted"] = () =>
    this.read((src) => {
      const rows = src.responses.flatMap((r) => toDeletedRow(r, src));
      return ok(rows.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt)));
    });

  readonly editResponse: ResponseRepo["editResponse"] = (id, answers, s) =>
    this.write(s, (d, me, now) => {
      const response = d.responses.find((r) => r.id === id);
      if (response?.deletedAt !== null) return err("NOT_FOUND", NOT_FOUND);
      const valid = validateSubmission(answers);
      if (!valid.ok) return err("VALIDATION", "Some answers are missing", valid.missing);
      const { oldValue, newValue } = diffAnswers(response.answers, valid.answers);
      if (Object.keys(oldValue).length + Object.keys(newValue).length > 0) {
        this.audit(d, { me, now }, { action: "response.edit", id, oldValue, newValue });
      }
      response.answers = valid.answers;
      this.reconcile(d, { me, now }, id, valid.answers);
      return this.detail(id, d, me);
    });

  /** SPEC F-4 step 4 after an edit: create, auto-resolve or update the response's alert. */
  private reconcile(d: Draft, ctx: { me: User; now: Date }, id: string, answers: AnswerMap): void {
    const existing = d.alerts.find((a) => a.responseId === id) ?? null;
    const reasons = evaluateAlertReasons(answers);
    const { alert, change } = reconcileAlert(existing, reasons, ctx.now, {
      id: newId("al"),
      responseId: id,
    });
    if (alert === null || change === "none") return;
    if (existing === null) d.alerts.push(alert);
    else d.alerts.splice(d.alerts.indexOf(existing), 1, alert);
    const entry = this.alertAudit(change, alert, existing);
    if (entry !== null) this.audit(d, ctx, entry);
  }

  private alertAudit(change: AlertChange, alert: Alert, old: Alert | null): AuditInput | null {
    if (change === "created") {
      const newValue = { responseId: alert.responseId, reasons: alert.reasons };
      return { action: "alert.create", id: alert.id, oldValue: null, newValue };
    }
    if (change !== "auto_resolved") return null;
    return {
      action: "alert.status",
      id: alert.id,
      oldValue: old?.status ?? null,
      newValue: "resolved",
      note: alert.notes.at(-1)?.text ?? "",
    };
  }

  readonly deleteResponse: ResponseRepo["deleteResponse"] = (id, s) =>
    this.write(s, (d, me, now) => {
      const response = d.responses.find((r) => r.id === id);
      if (response?.deletedAt !== null) return err("NOT_FOUND", NOT_FOUND);
      const deletedAt = now.toISOString();
      response.deletedAt = deletedAt;
      const [oldValue, newValue] = [{ deletedAt: null }, { deletedAt }];
      this.audit(d, { me, now }, { action: "response.delete", id, oldValue, newValue });
      return ok(undefined);
    });

  readonly restoreResponse: ResponseRepo["restoreResponse"] = (id, s) =>
    this.write(s, (d, me, now) => {
      const response = d.responses.find((r) => r.id === id);
      if (response === undefined || response.deletedAt === null) return err("NOT_FOUND", NOT_FOUND);
      const [oldValue, newValue] = [{ deletedAt: response.deletedAt }, { deletedAt: null }];
      response.deletedAt = null;
      this.audit(d, { me, now }, { action: "response.restore", id, oldValue, newValue });
      return ok(undefined);
    });

  private audit(d: Pick<Db, "audit">, ctx: { me: User; now: Date }, e: AuditInput): void {
    const { id, note, ...rest } = e;
    appendAudit(
      d,
      {
        ...rest,
        ...(note === undefined ? {} : { note }),
        actorId: ctx.me.id,
        actorName: ctx.me.name,
        entityType: e.action.startsWith("alert.") ? "alert" : "response",
        entityId: id,
      },
      ctx.now,
    );
  }

  /** Shared write path: admin check, password step-up, then one `mutate`. */
  private write<T>(s: StepUp, fn: (d: Draft, me: User, now: Date) => Result<T>): Promise<Result<T>> {
    return guardWrite(async () => {
      const me = this.admin();
      if ("ok" in me) return me;
      const hash = await hashPassword(s.password);
      const now = this.deps.clock.now();
      return this.deps.store.mutate([...WRITE_KEYS], (d): Result<T> => {
        if (d.users.find((u) => u.id === me.id)?.passwordHash !== hash) {
          return err("BAD_PASSWORD", BAD_PASSWORD);
        }
        return fn(d, me, now);
      });
    });
  }
}
