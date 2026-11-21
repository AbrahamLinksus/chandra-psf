import { hashPassword } from "./crypto";
import { addDays, istDateOf, istToISOTime } from "@/domain/time";
import type { Seed, SeedTime } from "@/domain/schemas";
import type { ISODate, ISOTime } from "@/domain/types";
import type { Db } from "./db";
import { encodeToken } from "./repos/token";

type Rebase = { time: (s: SeedTime) => ISOTime; date: (s: SeedTime) => ISODate };

function rebaser(now: Date): Rebase {
  const today = istDateOf(now);
  return {
    time: (s) => istToISOTime(addDays(today, s.dayOffset), s.minute),
    date: (s) => addDays(today, s.dayOffset),
  };
}

function rebaseVisits(seed: Seed, r: Rebase): Db["visits"] {
  const nullable = (s: SeedTime | null): ISOTime | null => (s === null ? null : r.time(s));
  return seed.visits.map((v) => {
    const base = {
      ...v,
      createdAt: r.time(v.createdAt),
      expiresAt: r.time(v.expiresAt),
      openedAt: nullable(v.openedAt),
      completedAt: nullable(v.completedAt),
      cancelledAt: nullable(v.cancelledAt),
    };
    return { ...base, token: encodeToken(base) };
  });
}

function rebaseResponsesAndAlerts(seed: Seed, r: Rebase): Pick<Db, "responses" | "alerts"> {
  return {
    responses: seed.responses.map((x) => ({
      ...x,
      submittedAt: r.time(x.submittedAt),
      deletedAt: x.deletedAt === null ? null : r.time(x.deletedAt),
    })),
    alerts: seed.alerts.map((a) => ({
      ...a,
      notes: a.notes.map((n) => ({ ...n, at: r.time(n.at) })),
      createdAt: r.time(a.createdAt),
      updatedAt: r.time(a.updatedAt),
    })),
  };
}

/** Absolute dates counted back from `now`'s IST day; users get the demo password hash (LLD 4). */
export async function rebaseSeed(seed: Seed, now: Date, password: string): Promise<Db> {
  const r = rebaser(now);
  const passwordHash = await hashPassword(password);
  return {
    meta: { schemaVersion: 1, seededAt: now.toISOString() },
    users: seed.users.map((u) => ({ ...u, createdAt: r.time(u.createdAt), passwordHash })),
    advisors: seed.advisors,
    jobCards: seed.jobCards.map((j) => ({ ...j, serviceDate: r.date(j.serviceDate) })),
    visits: rebaseVisits(seed, r),
    ...rebaseResponsesAndAlerts(seed, r),
    audit: seed.audit.map((a) => ({ ...a, at: r.time(a.at) })),
  };
}
