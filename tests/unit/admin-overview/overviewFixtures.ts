import type {
  AnalyticsInput,
  AnswerMap,
  Filters,
  JobCard,
  ResponseRecord,
  Visit,
} from "@/domain/types";

export const NOW = new Date("2026-03-10T06:30:00.000Z");
export const F: Filters = { from: "2026-02-09", to: "2026-03-10" };

export function card(n: number, over: Partial<JobCard> = {}): JobCard {
  return {
    jobCardNo: `JC-${String(n)}`,
    customerName: "A",
    phone: null,
    regNo: "R",
    model: "Activa",
    vehicleType: "scooter",
    serviceType: "Paid",
    serviceDate: "2026-03-01",
    advisorId: "a1",
    ...over,
  };
}

function visit(n: number, over: Partial<Visit> = {}): Visit {
  return {
    id: `v${String(n)}`,
    jobCardNo: `JC-${String(n)}`,
    phone: null,
    token: "t",
    createdBy: "u",
    createdAt: "2026-03-01T00:00:00.000Z",
    expiresAt: "2026-03-08T00:00:00.000Z",
    openedAt: null,
    completedAt: null,
    cancelledAt: null,
    replacedBy: null,
    ...over,
  };
}

function response(n: number, answers: AnswerMap, submittedAt = "2026-03-02T00:00:00.000Z") {
  const rec: ResponseRecord = {
    id: `r${String(n)}`,
    visitId: `v${String(n)}`,
    questionsVersion: 2,
    submittedAt,
    answers,
    deletedAt: null,
  };
  return rec;
}

export interface Row {
  card?: Partial<JobCard>;
  visit?: Partial<Visit>;
  answers?: AnswerMap;
  submittedAt?: string;
}

/** One entry per visit; `answers` present means a live response. */
export function build(rows: Row[], openAlerts = 0): AnalyticsInput {
  const visits = rows.map((r, i) => ({
    visit: visit(i, {
      ...(r.answers ? { completedAt: "2026-03-02T00:00:00.000Z" } : {}),
      ...r.visit,
    }),
    jobCard: card(i, r.card),
  }));
  const responses = rows.flatMap((r, i) => {
    const v = visits[i];
    return r.answers && v ? [{ response: response(i, r.answers, r.submittedAt), ...v }] : [];
  });
  return { visits, responses, openAlerts, now: NOW };
}
