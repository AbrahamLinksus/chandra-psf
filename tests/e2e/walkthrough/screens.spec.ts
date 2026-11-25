/* eslint-disable max-lines-per-function -- one screenshot tour per role */
import { expect, test } from "@playwright/test";
import { createSupportUser, rpcCall } from "../../support/e2e";
import { sharedAdminApi, sharedAdminInBrowser } from "../admin-users/sharedAdmin";
import { newBranch } from "../support-links/helpers";
import {
  CALLBACK,
  OWN,
  TEMP,
  afterFirstRunStarted,
  answerCallback,
  branchAdminFor,
  capture,
  cardWithLink,
  digits,
  expectLabelled,
  expectNoDemo,
  fillUntilCallback,
  isDesktop,
  regOf,
  setPasswordUI,
  shot,
  signInUI,
  submitForm,
  today,
  uniq,
} from "./helpers";

test.beforeAll(afterFirstRunStarted);

test.describe("T-11b SPEC 7 screens at 360 and 1440 px (G-W5, DoD last item)", () => {
  test("public screens: sign-in, privacy and every customer form state", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const { staff } = await newBranch(playwright, String(baseURL), {
      label: "Screens",
      name: "Kavitha",
    });
    const fresh = await cardWithLink(staff, {
      name: "Ramesh Kumar",
      phone: digits(),
      reg: regOf(),
      date: today(),
    });

    await capture(page, "/sign-in", "sign-in");
    await expect(page.getByText("Forgot your password? Ask your admin to reset it.")).toBeVisible();
    await expect(page.getByRole("combobox")).toHaveCount(0); // no role picker
    await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
    await capture(page, "/privacy", "privacy");

    await capture(page, `/f/${fresh.code}`, "form-welcome");
    await page.getByRole("button", { name: "Start" }).click();
    await expect(page.locator('[data-question="Q1"]')).toBeVisible();
    await expectLabelled(page, "form step");
    await shot(page, "form-step");

    await fillUntilCallback(page, 5, true);
    await expect(page.locator('[data-question="Q10"]')).toBeVisible();
    await expectLabelled(page, "form callback");
    await shot(page, "form-callback");
    await answerCallback(page, "Yes");
    await submitForm(page);
    await expect(page.getByRole("heading", { name: "Thank you for your feedback" })).toBeVisible();
    await expectNoDemo(page, "form thank-you");
    await shot(page, "form-thank-you");

    await page.goto(`/f/${fresh.code}`);
    await expect(page.getByText("Thank you — already submitted")).toBeVisible();
    await shot(page, "form-state-already-submitted");

    await page.goto(`/f/${"a".repeat(43)}`);
    await expect(page.getByText("Link not valid")).toBeVisible();
    await expectNoDemo(page, "form not valid");
    await shot(page, "form-state-not-valid");
  });

  test("support screens: set-password, my links, new link, my account, not-allowed", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const base = String(baseURL);
    const admin = await sharedAdminApi(playwright, base);
    const { branchId, staff } = await newBranch(playwright, base, {
      label: "Support",
      name: "Meena",
    });
    await cardWithLink(staff, {
      name: "Ramesh Kumar",
      phone: digits(),
      reg: regOf(),
      date: today(),
    });
    const email = `scr${uniq()}@ch.in`;
    await createSupportUser(admin, { name: "Latha", email, tempPassword: TEMP, branchId });

    await page.goto("/sign-in");
    await signInUI(page, email, TEMP);
    await expect(page).toHaveURL(/\/set-password$/);
    await expect(page.getByRole("heading", { name: "Set your password" })).toBeVisible();
    await expectLabelled(page, "/set-password");
    await expectNoDemo(page, "/set-password");
    await shot(page, "set-password");
    await setPasswordUI(page, OWN);
    await expect(page).toHaveURL(/\/support$/);

    await expect(page.getByRole("link", { name: "New feedback link" })).toBeVisible();
    await expectLabelled(page, "/support");
    await expectNoDemo(page, "/support");
    await shot(page, "support-list");
    await page.getByLabel("All branch links").click();
    await expect(page.getByText("Created by Meena")).toBeVisible();
    await shot(page, "support-list-all-branch");

    await capture(page, "/support/new", "support-new");
    await capture(page, "/account", "my-account");
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/not-allowed$/);
    await expectNoDemo(page, "/not-allowed");
    await shot(page, "not-allowed");
  });

  test("admin screens: main admin sees every admin screen; branch admin sees theirs", async ({
    page,
    browser,
    playwright,
    baseURL,
  }) => {
    const base = String(baseURL);
    const { branchId, staff } = await newBranch(playwright, base, {
      label: "Admin screens",
      name: "Kavitha",
    });
    await cardWithLink(
      staff,
      { name: "Ramesh Kumar", phone: digits(), reg: regOf(), date: today() },
      CALLBACK,
    );
    const boss = await branchAdminFor(playwright, base, branchId);
    const responses = await rpcCall<{ id: string }[]>(boss.api, "responses", "listResponses", [
      { from: "2000-01-01", to: "2100-01-01" },
    ]);
    const responseId = responses[0]?.id ?? "";
    expect(responseId).not.toBe("");

    await sharedAdminInBrowser(page, playwright, base);
    await capture(page, "/admin", "admin-overview");
    if (!isDesktop(page)) {
      await page.getByRole("button", { name: "More" }).click();
      await expect(page.getByRole("link", { name: "Customers" })).toBeVisible();
      await shot(page, "admin-more-menu");
    } else {
      await expect(page.getByRole("link", { name: "Customers" })).toBeVisible();
    }
    await capture(page, "/admin/alerts", "admin-alerts");
    await capture(page, "/admin/responses", "admin-responses");
    await capture(page, `/admin/responses/${responseId}`, "admin-response-detail");
    await capture(page, "/admin/responses/deleted", "admin-deleted");
    await capture(page, "/admin/audit", "admin-audit");
    await capture(page, "/admin/users", "admin-users");
    await capture(page, "/admin/branches", "admin-branches");
    await capture(page, `/admin/branches/${branchId}`, "admin-branch");
    await capture(page, "/admin/customers", "admin-customers");
    await capture(page, "/account", "my-account-admin");

    const context = await browser.newContext({ baseURL: base, viewport: page.viewportSize() });
    await context.addCookies(boss.cookies);
    const mine = await context.newPage();
    await capture(mine, "/admin", "branch-admin-overview");
    await capture(mine, "/admin/advisors", "branch-admin-advisors");
    await mine.goto("/admin/customers");
    // The page shell opens for a branch admin; the server refuses the search itself (DoD 10).
    await mine.getByLabel("Phone number or registration number").fill(digits());
    await mine.getByRole("button", { name: "Search" }).click();
    await expect(mine.getByText("Not allowed")).toBeVisible();
    await expect(mine.getByRole("checkbox")).toHaveCount(0);
    await shot(mine, "branch-admin-customers-not-allowed");
    await context.close();
  });
});
