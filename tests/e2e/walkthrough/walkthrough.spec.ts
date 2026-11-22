/* eslint-disable max-lines-per-function -- walkthrough scenarios read top to bottom */
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { signInAs } from "../../support/e2e";
import {
  confirmPassword,
  isDesktop,
  makeToken,
  moveAlert,
  signOutSupport,
  stored,
  submitForm,
} from "./helpers";

interface AuditRow {
  action: string;
  oldValue: unknown;
  newValue: unknown;
}
interface AlertRow {
  responseId: string;
  status: string;
}
interface ResponseRow {
  id: string;
  visitId: string;
  answers: Record<string, unknown>;
}

const tile = (page: Page, label: string) =>
  page.getByTestId("kpi-tile").filter({ hasText: label }).locator("p").nth(1);
const badge = (page: Page) => page.getByLabel(/\d+ open/).first();

async function generateLink(page: Page): Promise<string> {
  await page.goto("/support/new");
  await page.getByLabel("Job card number").fill("JC-24-1042");
  await page.getByRole("button", { name: "Look up" }).click();
  await page.getByRole("button", { name: "Generate link" }).click();
  const url = (await page.getByTestId("link-url").textContent()) ?? "";
  return new URL(url).pathname;
}

/** Signs out in place (no reload), then signs in as admin through the picker. */
async function switchToAdmin(page: Page): Promise<void> {
  await signOutSupport(page);
  await page.getByRole("button", { name: "Sign in as Admin" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

/** The sign-in init script re-applies Support 1 on every load of `page`, so admin gets a fresh tab. */
async function adminTab(page: Page, context: BrowserContext): Promise<Page> {
  await page.goto("/support");
  await signOutSupport(page);
  const admin = await context.newPage();
  await admin.goto("/sign-in");
  await admin.getByRole("button", { name: "Sign in as Admin" }).click();
  await expect(admin).toHaveURL(/\/admin$/);
  return admin;
}

test.describe("T-11 definition-of-done walkthrough", () => {
  test("S-06 two tabs: a submission in tab B shows in tab A live and a save in A keeps it", async ({
    page,
    context,
  }) => {
    await signInAs(page, "support1");
    const path = await generateLink(page);
    await page.goto("/support");
    const row = page.getByRole("listitem").filter({ hasText: "JC-24-1042" });
    await expect(row.getByText("Created", { exact: true })).toBeVisible();

    const tabB = await context.newPage();
    await submitForm(tabB, path, { q6: "1 Very poor", q15: "Yes" });
    await expect(row.getByText("Completed", { exact: true })).toBeVisible();

    // same tab A, no reload: sign out and in as admin through the UI
    await switchToAdmin(page);
    await page
      .getByRole("link", { name: /Alerts/ })
      .first()
      .click();
    await expect(page.getByRole("heading", { name: "Alerts" })).toBeVisible();
    const before = isDesktop(page) ? Number((await badge(page).innerText()).trim()) : 0;
    const listed = await page.locator("li > button[data-status]").count();

    await submitForm(tabB, `/f/${makeToken("v-t11-b", 1, "JC-24-1043")}`, {
      q6: "5 Excellent",
      q15: "Yes",
    });
    if (isDesktop(page)) await expect(badge(page)).toHaveText(String(before + 1));
    await expect(page.locator("li > button[data-status]")).toHaveCount(listed + 1);

    await moveAlert(page, /Kavitha P/, "Contacted");
    await expect(page.getByRole("button", { name: /Kavitha P/ })).toHaveAttribute(
      "data-status",
      "contacted",
    );
    const responses = await stored<ResponseRow>(tabB, "responses");
    const theirs = responses.filter((r) => r.visitId === "v-t11-b");
    expect(theirs).toHaveLength(1);
    const alerts = await stored<AlertRow>(tabB, "alerts");
    expect(alerts.some((a) => a.responseId === theirs[0]?.id && a.status === "open")).toBe(true);
    expect(alerts).toHaveLength(listed + 1);
  });

  test("AC-3 AC-7 AC-8 S-12 link -> Opened -> submit Q6=1 Q15=Yes -> alert Open -> Contacted -> Resolved, all audited", async ({
    page,
    context,
  }) => {
    await signInAs(page, "support1");
    const path = await generateLink(page);
    await page.goto("/support");
    const row = page.getByRole("listitem").filter({ hasText: "JC-24-1042" });
    await expect(row.getByText("Created", { exact: true })).toBeVisible();

    await page.goto(path);
    await expect(page.getByRole("button", { name: "Start" })).toBeVisible();
    await page.goto("/support");
    await expect(row.getByText("Opened", { exact: true })).toBeVisible();

    await submitForm(page, path, { q6: "1 Very poor", q15: "Yes" });
    await page.goto("/support");
    await expect(row.getByText("Completed", { exact: true })).toBeVisible();

    const admin = await adminTab(page, context);
    await admin.goto("/admin/alerts");
    const alert = admin.getByRole("button", { name: /Ramesh Kumar/ });
    await expect(alert).toHaveAttribute("data-status", "open");
    await moveAlert(admin, /Ramesh Kumar/, "Contacted");
    await expect(alert).toHaveAttribute("data-status", "contacted");
    await moveAlert(admin, /Ramesh Kumar/, "Resolved");
    await expect(alert).toHaveAttribute("data-status", "resolved");

    await admin.goto("/admin/audit");
    await expect(admin.getByTestId("audit-row").first()).toBeVisible();
    const all = await stored<AuditRow>(admin, "audit");
    const rows = all.filter((a) => a.action === "alert.status").slice(-2);
    expect(rows.map((a) => [a.oldValue, a.newValue])).toEqual([
      ["open", "contacted"],
      ["contacted", "resolved"],
    ]);
    const shown = admin.getByTestId("audit-row").filter({ hasText: "Alert status changed" });
    expect(await shown.count()).toBeGreaterThanOrEqual(2);
  });

  test("D-16 the Q6a audit value is the raw {options:[...]}", async ({ page, context }) => {
    await signInAs(page, "support1");
    const path = await generateLink(page);
    await submitForm(page, path, { q6: "1 Very poor", q15: "No" });
    const admin = await adminTab(page, context);
    const mine = (await stored<ResponseRow>(admin, "responses")).filter(
      (r) =>
        !r.id.startsWith("r-s") &&
        (r.answers["Q6a"] as { options?: string[] } | undefined)?.options?.[0] === "Rude",
    );
    expect(mine).toHaveLength(1);
    await admin.goto(`/admin/responses/${mine[0]?.id ?? ""}`);
    await admin.getByRole("button", { name: "Edit", exact: true }).click();
    await admin
      .getByRole("group", { name: /Satisfied with the behaviour|Q6|behaviour/i })
      .getByRole("button", { name: "4", exact: true })
      .click();
    await admin.getByRole("button", { name: "Save changes" }).click();
    await confirmPassword(admin);
    await expect(admin.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
    const entry = (await stored<AuditRow>(admin, "audit")).find(
      (a) => a.action === "response.edit",
    );
    expect(entry?.oldValue).toEqual({ Q6: 1, Q6a: { options: ["Rude"] } });
    expect(entry?.newValue).toEqual({ Q6: 4 });
  });

  test("S-09 delete a response: KPIs drop and its alert leaves; Restore brings all back", async ({
    page,
  }) => {
    await signInAs(page, "admin");
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    const openAlerts = Number(await tile(page, "Open alerts").innerText());
    expect(openAlerts).toBeGreaterThan(0);
    const received = Number(await tile(page, "Responses received").innerText());
    const rateBefore = await tile(page, "Response rate").innerText();
    expect(received).toBeGreaterThan(1);

    // r-s005 (Kavitha P) stands in for the spec's CUST-014: recent, with an open alert
    await page.goto("/admin/responses/r-s005");
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    await confirmPassword(page);
    await expect(page).toHaveURL(/\/admin\/responses$/);

    await page.goto("/admin");
    await expect(tile(page, "Responses received")).toHaveText(String(received - 1));
    await expect(tile(page, "Response rate")).not.toHaveText(rateBefore);
    await expect(tile(page, "Open alerts")).toHaveText(String(openAlerts - 1));
    await page.goto("/admin/alerts");
    await expect(page.getByRole("heading", { name: "Alerts" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Kavitha P/ })).toHaveCount(0);

    await page.goto("/admin/responses/deleted");
    await page
      .locator('li[data-response-id="r-s005"]')
      .getByRole("button", { name: "Restore" })
      .click();
    await confirmPassword(page);
    await expect(page.getByText("Nothing deleted")).toBeVisible();

    await page.goto("/admin");
    await expect(tile(page, "Responses received")).toHaveText(String(received));
    await expect(tile(page, "Response rate")).toHaveText(rateBefore);
    await expect(tile(page, "Open alerts")).toHaveText(String(openAlerts));
    await page.goto("/admin/alerts");
    await expect(page.getByRole("button", { name: /Kavitha P/ })).toHaveAttribute(
      "data-status",
      "open",
    );
    const actions = (await stored<AuditRow>(page, "audit"))
      .map((a) => a.action)
      .filter((a) => a.startsWith("response."));
    expect(actions).toEqual(["response.delete", "response.restore"]);
  });

  test("AC-6 D-15 a support session is redirected to /not-allowed from every /admin URL, no data", async ({
    page,
  }) => {
    await signInAs(page, "support1");
    const urls = [
      "/admin",
      "/admin/alerts",
      "/admin/responses",
      "/admin/responses/r-s001",
      "/admin/responses/deleted",
      "/admin/audit",
      "/admin/users",
    ];
    for (const url of urls) {
      await page.goto(url);
      await expect(page).toHaveURL(/\/not-allowed$/);
      await expect(page.getByText("You don't have access to this page")).toBeVisible();
      await expect(page.locator("body")).not.toContainText(/Kavitha|Responses received|@chandra/);
    }
  });
});
