import type { JobCardRepo } from "@/data/access/repos/jobCards";
import { err, ok } from "@/data/access/result";
import { normalizeJobCardNo } from "@/domain/jobCard";
import type { RepoDeps } from "../repoDeps";
import { guardRead } from "../results";
import { currentVisitOf, JOB_CARD_NOT_FOUND, SIGN_IN, toVisitSummary } from "./visits";

const EMPTY_MESSAGE = "Enter a job card number";

export class LocalJobCardRepo implements JobCardRepo {
  constructor(protected readonly deps: RepoDeps) {}

  readonly getJobCard: JobCardRepo["getJobCard"] = (jobCardNo) =>
    guardRead(async () => {
      await this.deps.store.whenReady();
      const me = this.deps.session.current();
      if (me === null) return err("UNAUTHENTICATED", SIGN_IN);
      const wanted = normalizeJobCardNo(jobCardNo);
      if (wanted === "") return err("VALIDATION", EMPTY_MESSAGE, ["jobCardNo"]);
      const jobCard = this.deps.store.read("jobCards").find((j) => normalizeJobCardNo(j.jobCardNo) === wanted);
      if (jobCard === undefined) return err("NOT_FOUND", JOB_CARD_NOT_FOUND);
      const advisor = this.deps.store.read("advisors").find((a) => a.id === jobCard.advisorId);
      const visit = currentVisitOf(this.deps.store.read("visits"), jobCard.jobCardNo);
      return ok({
        jobCard: { ...jobCard, advisorName: advisor?.name ?? "" },
        current: visit === null ? null : toVisitSummary(visit, jobCard, this.deps.clock.now(), me.id),
      });
    });

  /** Job cards without any visit yet, newest service first (presenter hint, S-07). */
  readonly listFreshJobCards: JobCardRepo["listFreshJobCards"] = () =>
    guardRead(async () => {
      await this.deps.store.whenReady();
      if (this.deps.session.current() === null) return err("UNAUTHENTICATED", SIGN_IN);
      const used = new Set(this.deps.store.read("visits").map((v) => v.jobCardNo));
      const fresh = this.deps.store
        .read("jobCards")
        .filter((j) => !used.has(j.jobCardNo))
        .sort((a, b) => b.serviceDate.localeCompare(a.serviceDate) || a.jobCardNo.localeCompare(b.jobCardNo));
      return ok(fresh.map((j) => j.jobCardNo));
    });
}
