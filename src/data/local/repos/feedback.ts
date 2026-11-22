import type { FeedbackRepo, FormContext } from "@/data/access/repos/feedback";
import { err, ok, type Result } from "@/data/access/result";
import { SYSTEM_ACTOR } from "@/domain/constants";
import { evaluateAlertReasons, reconcileAlert } from "@/domain/alertRules";
import { QUESTIONNAIRE_V1 } from "@/domain/questionnaire";
import { validateSubmission } from "@/domain/visibility";
import { visitStatus } from "@/domain/visitStatus";
import type { AnswerMap, JobCard, ResponseRecord, Visit, VisitStatus } from "@/domain/types";
import type { Db } from "../db";
import { SaveFailed } from "../store";
import { newId } from "../ids";
import type { RepoDeps } from "../repoDeps";
import { guardRead, guardWrite } from "../results";
import { appendAudit } from "./auditWriter";
import { decodeToken } from "./token";

const IMPORTED_BY = "link";
const SIMULATED_MESSAGE = "Simulated failed save"; // message of the fault switch's SaveFailed (store.ts)
const INVALID_MESSAGE = "Link not valid";

interface Found {
  visit: Visit;
  jobCard: JobCard;
  /** true when the visit is not in this browser yet and was rebuilt from the token (S-12). */
  imported: boolean;
}

interface Slice {
  visits: Visit[];
  jobCards: JobCard[];
}

type SubmitDraft = Slice & Pick<Db, "responses" | "alerts" | "audit">;
type SubmitResult = Result<{ callbackRequested: boolean }>;

/** Finds the visit for a token; rebuilds it from the token payload when this browser lacks it. */
function lookup(db: Slice, token: string): Found | null {
  const payload = decodeToken(token);
  if (payload === null) return null;
  const jobCard = db.jobCards.find((j) => j.jobCardNo === payload.jobCardNo);
  if (jobCard === undefined) return null;
  const stored = db.visits.find((v) => v.id === payload.visitId);
  if (stored !== undefined) {
    // The stored row is the truth for status; the link only has to name the same visit and job card.
    return stored.jobCardNo === payload.jobCardNo ? { visit: stored, jobCard, imported: false } : null;
  }
  const visit: Visit = {
    id: payload.visitId,
    jobCardNo: payload.jobCardNo,
    phone: payload.phone,
    token,
    createdBy: IMPORTED_BY,
    createdAt: payload.createdAt,
    expiresAt: payload.expiresAt,
    openedAt: null,
    completedAt: null,
    cancelledAt: null,
    replacedBy: null,
  };
  return { visit, jobCard, imported: true };
}

function toContext(found: Found, status: VisitStatus): FormContext {
  const { visit, jobCard } = found;
  switch (status) {
    case "cancelled":
      return { state: "invalid" };
    case "completed":
      return { state: "completed" };
    case "expired":
      return { state: "expired", replaced: visit.replacedBy !== null };
    default:
      return {
        state: "ready",
        visitId: visit.id,
        customerName: jobCard.customerName,
        model: jobCard.model,
        regNo: jobCard.regNo,
        serviceDate: jobCard.serviceDate,
        questionnaire: QUESTIONNAIRE_V1,
      };
  }
}

function notValid(): Result<never> {
  return err("NOT_FOUND", INVALID_MESSAGE);
}

/** Why a visit cannot take a submission, or null when it can. CONFLICT here means "link expired". */
function submitBlock(status: VisitStatus): SubmitResult | null {
  if (status === "completed") return err("ALREADY_COMPLETED", "Already submitted");
  if (status === "cancelled") return notValid();
  if (status === "expired") return err("CONFLICT", "This feedback link has expired");
  return null;
}

/** Stores the alert (when the answers raise one) and its audit entry (SPEC F-4 step 1). */
function raiseAlert(draft: SubmitDraft, response: ResponseRecord, now: Date): void {
  const reasons = evaluateAlertReasons(response.answers);
  const ids = { id: newId("al"), responseId: response.id };
  const { alert } = reconcileAlert(null, reasons, now, ids);
  if (alert === null) return;
  draft.alerts.push(alert);
  appendAudit(
    draft,
    {
      actorId: SYSTEM_ACTOR,
      actorName: "System",
      action: "alert.create",
      entityType: "alert",
      entityId: alert.id,
      oldValue: null,
      newValue: alert.reasons,
    },
    now,
  );
}

function applySubmit(draft: SubmitDraft, token: string, answers: AnswerMap, now: Date): SubmitResult {
  const found = lookup(draft, token);
  if (found === null) return notValid();
  const blocked = submitBlock(visitStatus(found.visit, now));
  if (blocked !== null) return blocked;
  const checked = validateSubmission(answers);
  if (!checked.ok) return err("VALIDATION", "Some answers are missing", checked.missing);
  if (found.imported) draft.visits.push(found.visit);
  const at = now.toISOString();
  const response: ResponseRecord = {
    id: newId("r"),
    visitId: found.visit.id,
    questionsVersion: QUESTIONNAIRE_V1.version,
    submittedAt: at,
    answers: checked.answers,
    deletedAt: null,
  };
  draft.responses.push(response);
  found.visit.openedAt ??= at;
  found.visit.completedAt = at;
  raiseAlert(draft, response, now);
  return ok({ callbackRequested: checked.answers.Q15 === "Yes" });
}

export class LocalFeedbackRepo implements FeedbackRepo {
  constructor(protected readonly deps: RepoDeps) {}

  readonly getVisitByToken: FeedbackRepo["getVisitByToken"] = (token) =>
    guardRead(async () => {
      await this.deps.store.whenReady();
      const found = lookup(this.readSlice(), token);
      if (found === null) return ok<FormContext>({ state: "invalid" });
      return ok(toContext(found, visitStatus(found.visit, this.deps.clock.now())));
    });

  readonly markOpened: FeedbackRepo["markOpened"] = (token) =>
    guardWrite(async () => {
      await this.deps.store.whenReady();
      const found = lookup(this.readSlice(), token);
      if (found === null) return notValid();
      if (!this.needsOpen(found)) return ok(undefined);
      return this.writeOpened(token);
    });

  readonly submitResponse: FeedbackRepo["submitResponse"] = (token, answers) =>
    guardWrite(() =>
      this.deps.store.mutate(["visits", "jobCards", "responses", "alerts", "audit"], (draft) =>
        applySubmit(draft, token, answers, this.deps.clock.now()),
      ),
    );

  private readSlice(): Slice {
    return { visits: this.deps.store.read("visits"), jobCards: this.deps.store.read("jobCards") };
  }

  private needsOpen(found: Found): boolean {
    const status = visitStatus(found.visit, this.deps.clock.now());
    return found.visit.openedAt === null && status === "created";
  }

  /**
   * Housekeeping writes (import, opened) must not eat a simulated failed save armed for the real
   * submit (S-13): if one fails, the switch is re-armed for the next write.
   */
  private async writeOpened(token: string): Promise<Result<void>> {
    const at = this.deps.clock.now().toISOString();
    try {
      return await this.deps.store.mutate(["visits", "jobCards"], (draft) => {
        const found = lookup(draft, token);
        if (found === null) return notValid();
        if (found.imported) draft.visits.push(found.visit);
        found.visit.openedAt ??= at;
        return ok(undefined);
      });
    } catch (e) {
      if (e instanceof SaveFailed && e.message === SIMULATED_MESSAGE) this.deps.store.fault.armNextWrite();
      throw e;
    }
  }
}
