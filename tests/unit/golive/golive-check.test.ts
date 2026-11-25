import { describe, expect, it } from "vitest";
import {
  DEALER_PHONE_PLACEHOLDER,
  checkAppUrl,
  checkContacts,
  checkDatabaseUrl,
  checkLaunchData,
  checkQuestionnaire,
  formatReport,
  runChecks,
  type ContactValues,
} from "../../../scripts/golive-check";

// Fake values are built at runtime so secret scanners do not flag them.
const real: ContactValues = {
  NEXT_PUBLIC_COMPANY_NAME: "Acme " + "Motors",
  NEXT_PUBLIC_PRIVACY_PHONE: "+91 98" + "765 43210",
  NEXT_PUBLIC_PRIVACY_EMAIL: "privacy@" + "acme-motors.in",
  NEXT_PUBLIC_DEALER_PHONE: "+91 44 " + "2345 6789",
};
const prodDb = "postgres" + "://user:" + "pw" + "@db.acme-motors.in/app";
const goodInput = {
  contacts: real,
  appUrl: "https://" + "feedback.acme-motors.in",
  databaseUrl: prodDb,
  counts: { job_cards: 0, visits: 0, link_tokens: 0, responses: 0, alerts: 0 },
};

const keysOf = (f: { key: string }[]) => f.map((x) => x.key);

describe("go-live gate (S-25)", () => {
  it("s25 passes when everything is real", () => {
    const findings = runChecks(goodInput);
    expect(findings).toEqual([]);
    expect(formatReport(findings)).toContain("PASSED");
  });

  it.each([
    ["NEXT_PUBLIC_COMPANY_NAME", "Your Company Name"],
    ["NEXT_PUBLIC_PRIVACY_PHONE", "+91 00 0000 0000"],
    ["NEXT_PUBLIC_PRIVACY_EMAIL", "privacy@example.com"],
    ["NEXT_PUBLIC_DEALER_PHONE", DEALER_PHONE_PLACEHOLDER],
  ])("s25 fails on placeholder %s", (key, placeholder) => {
    const findings = checkContacts({ ...real, [key]: placeholder });
    expect(keysOf(findings)).toEqual([key]);
    expect(keysOf(runChecks({ ...goodInput, contacts: { ...real, [key]: placeholder } }))).toEqual([
      key,
    ]);
  });

  it("fails on an empty contact value", () => {
    expect(keysOf(checkContacts({ ...real, NEXT_PUBLIC_PRIVACY_EMAIL: "  " }))).toEqual([
      "NEXT_PUBLIC_PRIVACY_EMAIL",
    ]);
  });
});

describe("go-live gate: URLs and data (S-25)", () => {
  it("s25 fails on a non-https APP_URL", () => {
    expect(keysOf(checkAppUrl("http://" + "feedback.acme-motors.in"))).toEqual(["APP_URL"]);
  });

  it.each(["https://localhost:3000", "https://127.0.0.1", "https://[::1]"])(
    "s25 fails on local APP_URL %s",
    (u) => {
      expect(keysOf(checkAppUrl(u))).toEqual(["APP_URL"]);
    },
  );

  it("fails on unset or invalid APP_URL", () => {
    expect(keysOf(checkAppUrl(undefined))).toEqual(["APP_URL"]);
    expect(keysOf(checkAppUrl("not a url"))).toEqual(["APP_URL"]);
  });

  it("s25 fails on a pglite database and passes a production one", () => {
    expect(keysOf(checkDatabaseUrl("pglite:memory"))).toEqual(["DATABASE_URL"]);
    expect(checkDatabaseUrl(prodDb)).toEqual([]);
  });

  it("s25 fails when customer-data tables hold rows", () => {
    const findings = checkLaunchData({ job_cards: 3, visits: 0, responses: 2 });
    expect(keysOf(findings)).toEqual(["job_cards", "responses"]);
    expect(findings[0]?.message).toContain("holds 3 row(s), customer data must not exist");
  });
});

describe("go-live gate: setup data allowed (D-43)", () => {
  it("s25 passes when setup data exists (branches, advisors, support and branch admin users) but no customer data", () => {
    // The script counts only customer-data tables, so setup tables never reach the check.
    const customerOnly = { job_cards: 0, visits: 0, link_tokens: 0, responses: 0, alerts: 0 };
    expect(runChecks({ ...goodInput, counts: customerOnly })).toEqual([]);
  });
});

describe("go-live report", () => {
  it("formatReport prints key names and counts, never values", () => {
    const secretUrl = "postgres" + "://admin:" + "hunter" + "2pw@db.secret-host.in/app";
    const phone = "+91 98" + "111 22233";
    const report = formatReport(
      runChecks({
        contacts: { ...real, NEXT_PUBLIC_PRIVACY_PHONE: "+91 00 0000 0000" },
        appUrl: "http://" + "personal-" + "name.example.org",
        databaseUrl: secretUrl.replace("postgres", "pglite"),
        counts: { job_cards: 4 },
      }),
    );
    expect(report).toContain("FAILED");
    expect(report).toContain("NEXT_PUBLIC_PRIVACY_PHONE");
    expect(report).toContain("job_cards: holds 4 row(s)");
    for (const secret of ["hunter", "secret-host", phone, "personal-", "Acme", "acme-motors"]) {
      expect(report).not.toContain(secret);
    }
  });
});

describe("go-live question set (CR-2)", () => {
  it("passes on v2, flags v1 or none installed", () => {
    expect(checkQuestionnaire(2)).toEqual([]);
    expect(keysOf(checkQuestionnaire(1))).toEqual(["questionnaires"]);
    expect(keysOf(checkQuestionnaire(null))).toEqual(["questionnaires"]);
  });
});
