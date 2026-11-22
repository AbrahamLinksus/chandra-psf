import { fixedClock, MemoryStorage } from "../../support";
import type { DataAccess } from "@/data/access";
import { createLocalDataAccess } from "@/data/local/createLocalDataAccess";
import { encodeToken } from "@/data/local/repos/token";
import type { AnswerMap } from "@/domain/types";

export function makeData(search = ""): { da: DataAccess; storage: MemoryStorage } {
  window.sessionStorage.clear();
  window.history.replaceState({}, "", `/${search}`);
  const storage = new MemoryStorage();
  const da = createLocalDataAccess({ storage, locks: null, clock: fixedClock(), win: window });
  return { da, storage };
}

const NOW = "2026-03-10T06:30:00.000Z";
const DAY = 86_400_000;

/** A link for the seeded job card of Ramesh Kumar that this browser has never seen. */
export function freshToken(visitId = "v-test-1", ageDays = 1, jobCardNo = "JC-24-1042"): string {
  const created = new Date(new Date(NOW).getTime() - ageDays * DAY);
  return encodeToken({
    id: visitId,
    jobCardNo,
    createdAt: created.toISOString(),
    expiresAt: new Date(created.getTime() + 7 * DAY).toISOString(),
    phone: "+91 98400 12345",
  });
}

/** A complete, valid set of answers (all happy). */
export function happyAnswers(extra: AnswerMap = {}): AnswerMap {
  return {
    Q1: 5,
    Q2: "Yes",
    Q3: "No",
    Q4: "Yes",
    Q5: "Yes",
    Q6: 5,
    Q7: "Yes",
    Q8: "Yes",
    Q9: "Yes",
    Q10: "Yes",
    Q11: 5,
    Q12: 5,
    Q13: "Yes",
    Q15: "No",
    ...extra,
  };
}

export function readList<T>(storage: MemoryStorage, name: string): T[] {
  return JSON.parse(storage.getItem(`psf:v1:${name}`) ?? "[]") as T[];
}
