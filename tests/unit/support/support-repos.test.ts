/* eslint-disable max-lines-per-function -- describe blocks group many one-line tests */
import { describe, expect, it } from "vitest";
import { Browser, fixedClock, signInAs, type Tab } from "../../support";
import { buildWhatsAppUrl } from "@/domain/whatsapp";
import { toWhatsAppNumber } from "@/domain/phone";
import { normalizeJobCardNo } from "@/domain/jobCard";
import { LocalJobCardRepo } from "@/data/local/repos/jobCards";
import { LocalVisitRepo } from "@/data/local/repos/visits";
import { StoreSessionReader } from "@/data/local/session";

const SPEC_URL =
  "https://wa.me/919840012345?text=Hi%20Ramesh%20Kumar%2C%20thank%20you%20for%20servicing%20your%20Activa%206G%20(TN%2009%20BX%204521)%20at%20Chandra%20Honda.%20Please%20share%20your%20feedback%20(2%20mins)%3A%20https%3A%2F%2F";

async function setup(who: "support1" | "support2" = "support1") {
  const browser = new Browser();
  const tab = browser.openTab();
  await tab.store.whenReady();
  signInAs(tab, who);
  const deps = {
    store: tab.store,
    clock: fixedClock(),
    session: new StoreSessionReader(tab.store),
  };
  return { browser, tab, jobs: new LocalJobCardRepo(deps), visits: new LocalVisitRepo(deps) };
}

async function auditActions(tab: Tab): Promise<string[]> {
  await tab.store.whenReady();
  return tab.store.read("audit").map((a) => a.action);
}

describe("job card lookup (AC-1, S-02, G-01, G-05, S-07)", () => {
  it("JC-24-1042 returns the SPEC section 5 row", async () => {
    const { jobs } = await setup();
    const r = await jobs.getJobCard("JC-24-1042");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const c = r.value.jobCard;
    expect([c.customerName, c.phone, c.regNo, c.model, c.vehicleType, c.serviceType]).toEqual([
      "Ramesh Kumar",
      "+91 98400 12345",
      "TN 09 BX 4521",
      "Activa 6G",
      "scooter",
      "Paid service",
    ]);
    expect(c.advisorName).toBe("Suresh");
    expect(r.value.current).toBeNull();
  });

  it.each([" jc241042", "JC 24 1042", "jc-24-1042"])(
    "%j finds the same card (S-02)",
    async (typed) => {
      const { jobs } = await setup();
      const r = await jobs.getJobCard(typed);
      expect(r.ok && r.value.jobCard.jobCardNo).toBe("JC-24-1042");
    },
  );

  it("an unknown number is NOT_FOUND with the spec message (G-01)", async () => {
    const { jobs } = await setup();
    const r = await jobs.getJobCard("JC-99-0000");
    expect(r).toEqual({
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: "Job card not found. Check the number on the job card.",
      },
    });
  });

  it("an empty or blank input is a VALIDATION error (G-05)", async () => {
    const { jobs } = await setup();
    for (const blank of ["", "  ", " - "]) {
      const r = await jobs.getJobCard(blank);
      expect(!r.ok && r.error.code).toBe("VALIDATION");
    }
  });

  it("a card with a link returns it as current", async () => {
    const { jobs } = await setup();
    const r = await jobs.getJobCard("JC-24-1034");
    expect(r.ok && r.value.current?.status).toBeDefined();
  });

  it("listFreshJobCards lists exactly the cards with no visit, newest service first (S-07)", async () => {
    const { jobs, tab } = await setup();
    const r = await jobs.listFreshJobCards();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const used = new Set(tab.store.read("visits").map((v) => v.jobCardNo));
    expect(r.value.length).toBeGreaterThan(0);
    expect(r.value.every((n) => !used.has(n))).toBe(true);
    expect(r.value).toContain("JC-24-1042");
    const dates = r.value.map(
      (n) => tab.store.read("jobCards").find((j) => j.jobCardNo === n)?.serviceDate ?? "",
    );
    expect([...dates].sort().reverse()).toEqual(dates);
  });
});

describe("create link (AC-2, S-03)", () => {
  it("generates a Created link on /f/<token>, expiring in 7 days, with the SPEC wa.me url", async () => {
    const { visits, tab } = await setup();
    const r = await visits.createVisitLink({ jobCardNo: "JC-24-1042", phone: "+91 98400 12345" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.status).toBe("created");
    expect(r.value.url).toMatch(/\/f\/[^/]+$/);
    const days = (Date.parse(r.value.expiresAt) - Date.parse(r.value.createdAt)) / 86_400_000;
    expect(days).toBe(7);
    const encodedUrl = encodeURIComponent(r.value.url);
    expect(r.value.whatsappUrl).toBe(SPEC_URL.replace("https%3A%2F%2F", "") + encodedUrl);
    expect(await auditActions(tab)).toContain("link.create");
  });

  it("an edited mobile number is saved on the visit and used in wa.me (S-03)", async () => {
    const { visits, tab } = await setup();
    const r = await visits.createVisitLink({ jobCardNo: "JC-24-1042", phone: "98765 43210" });
    expect(r.ok && r.value.whatsappUrl).toContain("https://wa.me/919876543210?text=");
    expect(tab.store.read("visits").find((v) => v.jobCardNo === "JC-24-1042")?.phone).toBe(
      "98765 43210",
    );
  });

  it.each([["044 2345 6789"], ["  "], [null]])(
    "landline or blank phone %j has no wa.me url",
    async (phone) => {
      const { visits } = await setup();
      const r = await visits.createVisitLink({ jobCardNo: "JC-24-1042", phone });
      expect(r.ok && r.value.whatsappUrl).toBeNull();
    },
  );

  it("unknown job card is NOT_FOUND; second create is CONFLICT; unsigned is UNAUTHENTICATED", async () => {
    const { visits, tab } = await setup();
    const bad = await visits.createVisitLink({ jobCardNo: "JC-99-0000", phone: null });
    expect(!bad.ok && bad.error.code).toBe("NOT_FOUND");
    await visits.createVisitLink({ jobCardNo: "JC-24-1042", phone: null });
    const dup = await visits.createVisitLink({ jobCardNo: "jc 24 1042", phone: null });
    expect(!dup.ok && dup.error.code).toBe("CONFLICT");
    tab.store.writeSession(null);
    const out = await visits.createVisitLink({ jobCardNo: "JC-24-1045", phone: null });
    expect(!out.ok && out.error.code).toBe("UNAUTHENTICATED");
  });

  it("a Completed job card is ALREADY_COMPLETED 'Feedback already received'", async () => {
    const { visits } = await setup();
    const r = await visits.createVisitLink({ jobCardNo: "JC-24-1001", phone: null });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "ALREADY_COMPLETED", message: "Feedback already received" },
    });
  });
});

describe("my links (US-05, G-W2)", () => {
  it("lists only my own current links; Support 2 never sees Support 1's", async () => {
    const one = await setup("support1");
    const mine = await one.visits.listMyVisits();
    expect(mine.ok && mine.value.length).toBeGreaterThan(0);
    const ids = new Set(
      one.tab.store
        .read("visits")
        .filter((v) => v.createdBy === "u-support1")
        .map((v) => v.id),
    );
    expect(mine.ok && mine.value.every((s) => ids.has(s.id))).toBe(true);
    signInAs(one.tab, "support2");
    const theirs = await one.visits.listMyVisits();
    expect(theirs.ok && theirs.value.some((s) => ids.has(s.id))).toBe(false);
    expect(mine.ok && Object.keys(mine.value[0] ?? {})).not.toContain("answers");
  });

  it("search matches job card (any spacing) or reg. no", async () => {
    const { visits } = await setup();
    const all = await visits.listMyVisits();
    if (!all.ok) throw new Error("list failed");
    const first = all.value[0];
    if (first === undefined) throw new Error("no rows");
    const byJc = await visits.listMyVisits({
      search: first.jobCardNo.toLowerCase().replace(/-/g, " "),
    });
    expect(byJc.ok && byJc.value.map((v) => v.id)).toContain(first.id);
    const byReg = await visits.listMyVisits({ search: first.regNo.toLowerCase() });
    expect(byReg.ok && byReg.value.map((v) => v.id)).toContain(first.id);
    const none = await visits.listMyVisits({ search: "zzzz" });
    expect(none.ok && none.value).toEqual([]);
    const blank = await visits.listMyVisits({ search: "   " });
    expect(blank.ok && blank.value.length).toBe(all.value.length);
  });

  it("requires a session", async () => {
    const { visits, tab } = await setup();
    tab.store.writeSession(null);
    const r = await visits.listMyVisits();
    expect(!r.ok && r.error.code).toBe("UNAUTHENTICATED");
  });
});

describe("regenerate and cancel (S-05, S-14)", () => {
  it("regenerate replaces the link, old gets replacedBy, list shows the new one, audited", async () => {
    const { visits, tab } = await setup();
    const c = await visits.createVisitLink({ jobCardNo: "JC-24-1042", phone: "9876543210" });
    if (!c.ok) throw new Error("create failed");
    const r = await visits.regenerateLink(c.value.id);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.id).not.toBe(c.value.id);
    expect(r.value.url).not.toBe(c.value.url);
    expect(r.value.phone).toBe("9876543210");
    expect(tab.store.read("visits").find((v) => v.id === c.value.id)?.replacedBy).toBe(r.value.id);
    const list = await visits.listMyVisits();
    const ids = list.ok ? list.value.map((v) => v.id) : [];
    expect(ids).toContain(r.value.id);
    expect(ids).not.toContain(c.value.id);
    expect(await auditActions(tab)).toContain("link.regenerate");
  });

  it("cancel sets Cancelled and audits link.cancel; a cancelled link cannot be changed again", async () => {
    const { visits, tab } = await setup();
    const c = await visits.createVisitLink({ jobCardNo: "JC-24-1042", phone: null });
    if (!c.ok) throw new Error("create failed");
    const r = await visits.cancelLink(c.value.id);
    expect(r.ok && r.value.status).toBe("cancelled");
    expect(await auditActions(tab)).toContain("link.cancel");
    const again = await visits.regenerateLink(c.value.id);
    expect(!again.ok && again.error.code).toBe("CONFLICT");
  });

  it("after Cancel the job card lookup has no current link and a new link can be made (T-03)", async () => {
    const { visits, jobs } = await setup();
    const c = await visits.createVisitLink({ jobCardNo: "JC-24-1042", phone: null });
    if (!c.ok) throw new Error("create failed");
    await visits.cancelLink(c.value.id);
    const r = await jobs.getJobCard("JC-24-1042");
    expect(r.ok && r.value.current).toBeNull();
    const again = await visits.createVisitLink({ jobCardNo: "JC-24-1042", phone: null });
    expect(again.ok && again.value.id).not.toBe(c.value.id);
  });

  it("a Completed link cannot be regenerated; unknown id is NOT_FOUND; others' links are FORBIDDEN", async () => {
    const { visits, tab } = await setup("support1");
    const done = await visits.cancelLink("v-s001");
    expect(!done.ok && done.error.code).toBe("FORBIDDEN");
    const own = await visits.cancelLink("v-s002");
    expect(!own.ok && own.error.code).toBe("CONFLICT");
    const missing = await visits.cancelLink("nope");
    expect(!missing.ok && missing.error.code).toBe("NOT_FOUND");
    tab.store.writeSession(null);
    const out = await visits.cancelLink("v-s034");
    expect(!out.ok && out.error.code).toBe("UNAUTHENTICATED");
  });

  it("a failed save (S-13) returns SAVE_FAILED and changes nothing", async () => {
    const { visits, tab } = await setup();
    const c = await visits.createVisitLink({ jobCardNo: "JC-24-1042", phone: null });
    if (!c.ok) throw new Error("create failed");
    tab.fault.armNextWrite();
    const r = await visits.cancelLink(c.value.id);
    expect(!r.ok && r.error.code).toBe("SAVE_FAILED");
    expect(tab.store.read("visits").find((v) => v.id === c.value.id)?.cancelledAt).toBeNull();
  });
});

describe("domain helpers", () => {
  it("normalizeJobCardNo ignores case, spaces and dashes", () => {
    expect(normalizeJobCardNo(" jc-24 1042 ")).toBe("JC241042");
  });
  it("toWhatsAppNumber accepts 10-digit and +91 mobiles; rejects landline, short, blank", () => {
    expect(toWhatsAppNumber("98400 12345")).toBe("919840012345");
    expect(toWhatsAppNumber("+91 98400 12345")).toBe("919840012345");
    expect(toWhatsAppNumber("044 2345 6789")).toBeNull();
    expect(toWhatsAppNumber("12345")).toBeNull();
    expect(toWhatsAppNumber("+91 44 2345 6789")).toBeNull();
    expect(toWhatsAppNumber(null)).toBeNull();
  });
  it("buildWhatsAppUrl is null for a landline", () => {
    const ctx = { name: "A", model: "M", regNo: "R", url: "u" };
    expect(buildWhatsAppUrl("0442345678", ctx)).toBeNull();
  });
});

describe("review fixes: replaced link and signed-out lookup", () => {
  it("regenerate and cancel on an already-replaced link are CONFLICT; one live link remains", async () => {
    const { visits, tab } = await setup();
    const c = await visits.createVisitLink({ jobCardNo: "JC-24-1042", phone: "9876543210" });
    if (!c.ok) throw new Error("create failed");
    const first = await visits.regenerateLink(c.value.id);
    expect(first.ok).toBe(true);
    const again = await visits.regenerateLink(c.value.id);
    expect(!again.ok && again.error.code).toBe("CONFLICT");
    const cancel = await visits.cancelLink(c.value.id);
    expect(!cancel.ok && cancel.error.code).toBe("CONFLICT");
    const live = tab.store
      .read("visits")
      .filter((v) => v.jobCardNo === "JC-24-1042" && v.replacedBy === null);
    expect(live).toHaveLength(1);
  });

  it("getJobCard and listFreshJobCards are UNAUTHENTICATED when signed out", async () => {
    const { jobs, tab } = await setup();
    tab.store.writeSession(null);
    const a = await jobs.getJobCard("JC-24-1042");
    expect(a).toMatchObject({
      ok: false,
      error: { code: "UNAUTHENTICATED", message: "Sign in first" },
    });
    const b = await jobs.listFreshJobCards();
    expect(b).toMatchObject({
      ok: false,
      error: { code: "UNAUTHENTICATED", message: "Sign in first" },
    });
  });
});
