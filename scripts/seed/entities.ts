/** Seed entity builders: job cards, visits, responses, alerts, audit (SPEC 6, LLD 4). */
import { evaluateAlertReasons } from "../../src/domain/alertRules";
import { LINK_EXPIRY_DAYS } from "../../src/domain/constants";
import type { Seed, SeedTime } from "../../src/domain/schemas";
import type { AnswerMap } from "../../src/domain/types";
import { toAnswers, type SurveyRow } from "./answers";
import { ADVISORS, ALERT_PLAN, MODELS, SERVICE_TYPES, USERS } from "./data";

export type SeedJobCard = Seed["jobCards"][number];
export type SeedVisit = Seed["visits"][number];
export type SeedAlert = Seed["alerts"][number];
export type SeedAudit = Seed["audit"][number];
export type Rng = () => number;
export type Collections = Pick<Seed, "jobCards" | "visits" | "responses" | "alerts" | "audit">;
export type VisitKind = "completed" | "opened" | "created" | "expired";

/** mulberry32: tiny seeded PRNG. */
export function makeRng(seed: number): Rng {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

export const t = (dayOffset: number, minute: number): SeedTime => ({ dayOffset, minute });
export const pad = (n: number): string => String(n).padStart(3, "0");
const digits = (rng: Rng, n: number): string =>
  Array.from({ length: n }, () => String(Math.floor(rng() * 10))).join("");
export const workMinute = (rng: Rng): number => 540 + Math.floor(rng() * 420);

/** Job card numbers JC-24-1001.., skipping 1042 (kept for the SPEC example card with no visit). */
export function jobCardNo(i: number): string {
  const n = 1001 + i;
  return `JC-24-${String(n >= 1042 ? n + 1 : n)}`;
}

export function makeJobCard(
  no: string,
  customer: string,
  i: number,
  offset: number,
  rng: Rng,
): SeedJobCard {
  const m = MODELS[i % MODELS.length] ?? MODELS[0];
  const letters = String.fromCharCode(65 + Math.floor(rng() * 26), 65 + Math.floor(rng() * 26));
  const area = String(1 + Math.floor(rng() * 99)).padStart(2, "0");
  return {
    jobCardNo: no,
    customerName: customer,
    phone: `+91 9${digits(rng, 4)} ${digits(rng, 5)}`,
    regNo: `TN ${area} ${letters} ${digits(rng, 4)}`,
    model: m.model,
    vehicleType: m.vehicleType,
    serviceType: SERVICE_TYPES[Math.floor(rng() * SERVICE_TYPES.length)] ?? "Free service",
    serviceDate: t(offset, 0),
    advisorId: ADVISORS[(i + Math.floor(i / 5)) % ADVISORS.length]?.id ?? "a-suresh",
  };
}

export function makeVisit(
  id: string,
  card: SeedJobCard,
  kind: VisitKind,
  minute: number,
  n: number,
): SeedVisit {
  const offset = card.serviceDate.dayOffset;
  const reached = kind === "completed" || kind === "opened";
  return {
    id,
    jobCardNo: card.jobCardNo,
    phone: card.phone,
    createdBy: n % 2 === 0 ? "u-support1" : "u-support2",
    createdAt: t(offset, minute),
    expiresAt: t(offset + LINK_EXPIRY_DAYS, minute),
    openedAt: reached ? t(offset, minute + 15) : null,
    completedAt: kind === "completed" ? t(offset, minute + 22) : null,
    cancelledAt: null,
    replacedBy: null,
  };
}

export function linkAudit(v: SeedVisit, n: number): SeedAudit {
  const actor = USERS.find((u) => u.id === v.createdBy);
  return {
    id: `au-s${pad(n)}`,
    at: v.createdAt,
    actorId: v.createdBy,
    actorName: actor?.name ?? v.createdBy,
    action: "link.create",
    entityType: "visit",
    entityId: v.id,
    oldValue: null,
    newValue: { jobCardNo: v.jobCardNo },
  };
}

function statusAudit(alert: SeedAlert, n: number): SeedAudit[] {
  const note = alert.notes[0];
  if (note === undefined) return [];
  return [
    {
      id: `au-s${pad(100 + n)}`,
      at: note.at,
      actorId: "u-admin",
      actorName: "Admin",
      action: "alert.status",
      entityType: "alert",
      entityId: alert.id,
      oldValue: "open",
      newValue: alert.status,
      note: note.text,
    },
  ];
}

function alertFor(
  row: SurveyRow,
  answers: AnswerMap,
  done: SeedTime,
  n: number,
): { alert: SeedAlert; audit: SeedAudit[] } | null {
  const reasons = evaluateAlertReasons(answers);
  if (reasons.length === 0) return null;
  const plan = ALERT_PLAN[row.sampleId];
  const at = t(done.dayOffset, done.minute + 240);
  const alert: SeedAlert = {
    id: `al-s${pad(n)}`,
    responseId: `r-s${pad(n)}`,
    reasons,
    status: plan?.status ?? "open",
    notes: plan === undefined ? [] : [{ at, by: "Admin", text: plan.note }],
    createdAt: done,
    updatedAt: plan === undefined ? done : at,
  };
  return { alert, audit: statusAudit(alert, n) };
}

/** One completed visit + response (+ alert) per survey row, spread over the last ~3 months. */
export function buildAnswered(rows: SurveyRow[], span: number, rng: Rng): Collections {
  const out: Collections = { jobCards: [], visits: [], responses: [], alerts: [], audit: [] };
  shuffle(rows, rng).forEach((row, i) => {
    const n = i + 1;
    const offset = -(1 + Math.floor((i * span) / (rows.length - 1)));
    const card = makeJobCard(jobCardNo(i), row.customer, i, offset, rng);
    const visit = makeVisit(`v-s${pad(n)}`, card, "completed", workMinute(rng), n);
    const done = visit.completedAt as SeedTime;
    const answers = toAnswers(row);
    out.jobCards.push(card);
    out.visits.push(visit);
    out.audit.push(linkAudit(visit, n));
    out.responses.push({
      id: `r-s${pad(n)}`,
      visitId: visit.id,
      questionsVersion: 1,
      submittedAt: done,
      answers,
      deletedAt: null,
    });
    const raised = alertFor(row, answers, done, n);
    if (raised !== null) {
      out.alerts.push(raised.alert);
      out.audit.push(...raised.audit);
    }
  });
  return out;
}
