// @vitest-environment node
/* eslint-disable max-lines-per-function -- describe blocks group many one-line tests */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import type { JobCardInput } from "@/data/access/repos/jobCards";
import { advisors, auditLog, jobCards, visits } from "@/server/db/schema";
import type { SessionUser } from "@/server/ctx";
import { makeServerCtx, must, seedBranch, seedUser } from "../../../support/serverCtx";

vi.mock("server-only", () => ({}));

const { ServerJobCardRepo } = await import("@/server/repos/jobCards");

type Env = Awaited<ReturnType<typeof makeServerCtx>>;
let env: Env;

beforeEach(async () => {
  env = await makeServerCtx();
  env.clock.at = new Date("2026-11-24T06:30:00.000Z"); // 24 Nov 2026 IST
});
afterEach(async () => {
  await env.client.close();
});

const repo = () => new ServerJobCardRepo(env.ctx);
const audits = async (action: string) =>
  (await env.db.select().from(auditLog)).filter((a) => a.action === action);

function signIn(user: Partial<SessionUser> & Pick<SessionUser, "id" | "role">): void {
  env.ctx.session = {
    sessionId: "s",
    createdAt: env.clock.now(),
    lastActiveAt: env.clock.now(),
    user: { name: "Aide", email: "a@chandra.in", branchId: null, mustSetPassword: false, ...user },
  };
}

async function supportAt(branchId: string): Promise<string> {
  const id = await seedUser(env.db, { role: "support", branchId });
  signIn({ id, role: "support", branchId });
  return id;
}
async function advisor(branchId: string, name = "Suresh", active = true): Promise<string> {
  const [row] = await env.db.insert(advisors).values({ branchId, name, active }).returning();
  return must(row).id;
}

const NO = "JC-24-1042";
function ramesh(advisorId: string, over: Partial<JobCardInput> = {}): JobCardInput {
  return {
    jobCardNo: NO,
    customerName: "Ramesh Kumar",
    phone: "98400 12345",
    regNo: "tn09bx4521",
    model: "Activa",
    serviceType: "Paid service",
    serviceDate: "2026-11-14",
    advisorId,
    ...over,
  };
}
const create = (i: JobCardInput, requestId = crypto.randomUUID()) =>
  repo().createJobCard({ ...i, requestId });

async function setup() {
  const velachery = await seedBranch(env.db, "Velachery");
  const userId = await supportAt(velachery);
  const adv = await advisor(velachery);
  return { velachery, userId, adv };
}

describe("JobCardRepo create and look up (US-02, S-02)", () => {
  it("SPEC row: Ramesh Kumar is stored in display form and ` jc241042` finds it (S-02)", async () => {
    const { adv } = await setup();
    const made = await create(ramesh(adv));
    expect(made.ok && made.value).toMatchObject({
      jobCardNo: "JC-24-1042",
      customerName: "Ramesh Kumar",
      phone: "+91 98400 12345",
      regNo: "TN 09 BX 4521",
      model: "Activa",
      vehicleType: "scooter",
      serviceType: "Paid service",
      serviceDate: "2026-11-14",
      advisorName: "Suresh",
      branchName: "Velachery",
      editable: true,
    });
    const found = await repo().getJobCard(" jc241042");
    expect(found.ok && found.value.jobCard.regNo).toBe("TN 09 BX 4521");
    expect(found.ok && found.value.current).toBeNull();
    expect(await audits("jobcard.create")).toHaveLength(1);
  });

  it("not found gives the exact message with the number as typed, upper-cased", async () => {
    await setup();
    const r = await repo().getJobCard("jc-24-1042");
    expect(!r.ok && r.error.code).toBe("NOT_FOUND");
    expect(!r.ok && r.error.message).toBe("No job card JC-24-1042 at this branch yet");
  });

  it("Tambaram support looking up Velachery's JC-24-1042 gets not found (US-29)", async () => {
    const { adv } = await setup();
    expect((await create(ramesh(adv))).ok).toBe(true);
    await supportAt(await seedBranch(env.db, "Tambaram"));
    const r = await repo().getJobCard(NO);
    expect(!r.ok && r.error.message).toBe("No job card JC-24-1042 at this branch yet");
  });

  it("Tambaram may add its own JC-24-1042 (numbers are unique per branch only)", async () => {
    const { adv } = await setup();
    expect((await create(ramesh(adv))).ok).toBe(true);
    const tambaram = await seedBranch(env.db, "Tambaram");
    await supportAt(tambaram);
    const own = await advisor(tambaram, "Mani");
    const r = await create(ramesh(own));
    expect(r.ok && r.value.branchName).toBe("Tambaram");
  });
});

describe("JobCardRepo create errors (US-26, S-29, G-15)", () => {
  it("a duplicate at the same branch is CONFLICT on jobCardNo with the exact message", async () => {
    const { adv } = await setup();
    await create(ramesh(adv));
    const r = await create(ramesh(adv, { jobCardNo: "jc-24-1042" }));
    expect(!r.ok && r.error.code).toBe("CONFLICT");
    expect(!r.ok && r.error.message).toBe("JC-24-1042 already exists at this branch");
    expect(!r.ok && r.error.fields).toEqual(["jobCardNo"]);
  });

  it("a retry with the same request id returns the saved card, no second row (S-29, G-15)", async () => {
    const { adv } = await setup();
    const requestId = crypto.randomUUID();
    const first = await create(ramesh(adv), requestId);
    const retry = await create(ramesh(adv), requestId);
    expect(retry.ok && first.ok && retry.value.id).toBe(first.ok && first.value.id);
    expect(await env.db.select().from(jobCards)).toHaveLength(1);
    expect(await audits("jobcard.create")).toHaveLength(1);
  });

  it("no active advisors: ask your admin to add advisors for this branch", async () => {
    const b = await seedBranch(env.db, "Velachery");
    await supportAt(b);
    const gone = await advisor(b, "Old", false);
    const r = await create(ramesh(gone));
    expect(!r.ok && r.error.code).toBe("VALIDATION");
    expect(!r.ok && r.error.message).toBe("Ask your admin to add advisors for this branch");
  });

  it("an advisor of another branch is refused", async () => {
    await setup();
    const other = await advisor(await seedBranch(env.db, "Tambaram"), "Mani");
    const r = await create(ramesh(other));
    expect(!r.ok && r.error.fields).toEqual(["advisorId"]);
  });

  it("a future service date is refused with the exact message", async () => {
    const { adv } = await setup();
    const r = await create(ramesh(adv, { serviceDate: "2026-11-25" }));
    expect(!r.ok && r.error.code).toBe("VALIDATION");
    expect(!r.ok && r.error.message).toBe("Service date can't be in the future");
    expect(!r.ok && r.error.fields).toEqual(["serviceDate"]);
    expect(await env.db.select().from(jobCards)).toHaveLength(0);
  });

  it("an inactive branch is FORBIDDEN 'Account disabled, contact admin'", async () => {
    const b = await seedBranch(env.db, "Closed", false);
    await supportAt(b);
    const adv = await advisor(b);
    const r = await create(ramesh(adv));
    expect(!r.ok && r.error.code).toBe("FORBIDDEN");
    expect(!r.ok && r.error.message).toBe("Account disabled, contact admin");
  });

  it("a signed-out caller is refused", async () => {
    const { adv } = await setup();
    env.ctx.session = null;
    const r = await create(ramesh(adv));
    expect(r.ok).toBe(false);
  });
});

describe("JobCardRepo update (S-03, G-05)", () => {
  it("editing the phone is audited jobcard.update old to new, changed fields only", async () => {
    const { adv } = await setup();
    const made = await create(ramesh(adv));
    const id = must(made.ok ? made.value.id : null);
    const r = await repo().updateJobCard(id, { phone: "99999 88888" });
    expect(r.ok && r.value.phone).toBe("+91 99999 88888");
    const [a] = await audits("jobcard.update");
    expect(a?.oldValue).toEqual({ phone: "+91 98400 12345" });
    expect(a?.newValue).toEqual({ phone: "+91 99999 88888" });
  });

  it("editing details (customer name, advisor) is audited with both values", async () => {
    const { velachery, adv } = await setup();
    const made = await create(ramesh(adv));
    const other = await advisor(velachery, "Ravi");
    const r = await repo().updateJobCard(must(made.ok ? made.value.id : null), {
      customerName: "Ramesh K",
      advisorId: other,
    });
    expect(r.ok && r.value.advisorName).toBe("Ravi");
    const [a] = await audits("jobcard.update");
    expect(a?.oldValue).toEqual({ customerName: "Ramesh Kumar", advisorId: adv });
    expect(a?.newValue).toEqual({ customerName: "Ramesh K", advisorId: other });
  });

  it("a phone-only edit still works after the card's advisor was deactivated", async () => {
    const { adv } = await setup();
    const made = await create(ramesh(adv));
    await env.db.update(advisors).set({ active: false }).where(eq(advisors.id, adv));
    const r = await repo().updateJobCard(must(made.ok ? made.value.id : null), {
      phone: "99999 88888",
    });
    expect(r.ok && r.value.phone).toBe("+91 99999 88888");
  });

  it("an unchanged patch writes no audit row", async () => {
    const { adv } = await setup();
    const made = await create(ramesh(adv));
    await repo().updateJobCard(must(made.ok ? made.value.id : null), { phone: "+91 98400 12345" });
    expect(await audits("jobcard.update")).toHaveLength(0);
  });

  it("after the customer completed the feedback it is blocked: 'Feedback already received'", async () => {
    const { userId, velachery, adv } = await setup();
    const made = await create(ramesh(adv));
    const id = must(made.ok ? made.value.id : null);
    await env.db.insert(visits).values({
      jobCardId: id,
      branchId: velachery,
      createdBy: userId,
      expiresAt: new Date("2026-12-24T00:00:00Z"),
      completedAt: new Date("2026-11-20T00:00:00Z"),
    });
    const r = await repo().updateJobCard(id, { phone: "99999 88888" });
    expect(!r.ok && r.error.code).toBe("CONFLICT");
    expect(!r.ok && r.error.message).toBe("Feedback already received");
    expect(await audits("jobcard.update")).toHaveLength(0);
    const found = await repo().getJobCard(NO);
    expect(found.ok && found.value.jobCard.editable).toBe(false);
  });

  it("an invalid phone is VALIDATION and a card of another branch is NOT_FOUND", async () => {
    const { adv } = await setup();
    const made = await create(ramesh(adv));
    const id = must(made.ok ? made.value.id : null);
    const bad = await repo().updateJobCard(id, { phone: "12345" });
    expect(!bad.ok && bad.error.code).toBe("VALIDATION");
    await supportAt(await seedBranch(env.db, "Tambaram"));
    const away = await repo().updateJobCard(id, { phone: "99999 88888" });
    expect(!away.ok && away.error.code).toBe("NOT_FOUND");
  });

  it("renaming the number onto another card at the branch is CONFLICT 'already exists'", async () => {
    const { adv } = await setup();
    await create(ramesh(adv));
    const second = await create(ramesh(adv, { jobCardNo: "JC-24-2000" }));
    const r = await repo().updateJobCard(must(second.ok ? second.value.id : null), {
      jobCardNo: "JC-24-1042",
    });
    expect(!r.ok && r.error.message).toBe("JC-24-1042 already exists at this branch");
  });
});
