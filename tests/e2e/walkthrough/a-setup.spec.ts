/* eslint-disable max-lines-per-function -- one test plays the whole launch-day scenario */
import { expect, test, type Browser, type Page, type PlaywrightWorkerArgs } from "@playwright/test";
import {
  E2E_ADMIN_NEW_PASSWORD,
  adminCredentials,
  rpcCall,
  switchAdminPasswordOnce,
} from "../../support/e2e";
import { sharedAdminInBrowser } from "../admin-users/sharedAdmin";
import {
  OWN,
  TEMP,
  expectLabelled,
  expectNoDemo,
  setPasswordUI,
  shot,
  signInUI,
  uniq,
  width,
} from "./helpers";

type Playwright = PlaywrightWorkerArgs["playwright"];

const branchRow = (page: Page, name: string) => page.locator(`li[data-branch-name="${name}"]`);
const userRow = (page: Page, email: string) => page.locator(`li[data-user-email="${email}"]`);

async function addBranch(page: Page, name: string): Promise<void> {
  await page.getByLabel("Branch name").fill(name);
  await page.getByLabel("City", { exact: true }).fill("Chennai");
  await page.getByRole("button", { name: "Add branch" }).click();
  await expect(branchRow(page, name)).toContainText("Active");
}

async function addAdvisor(page: Page, branchId: string, name: string): Promise<void> {
  await page.goto(`/admin/branches/${branchId}`);
  await expect(page.getByRole("heading", { name: "Advisors" })).toBeVisible();
  await page.getByLabel("Advisor name").fill(name);
  await page.getByRole("button", { name: "Add advisor" }).click();
  await expect(page.locator("li").filter({ hasText: name })).toBeVisible();
}

async function addUser(
  page: Page,
  o: { name: string; email: string; role: "Branch admin" | "Support"; branch: string },
): Promise<void> {
  await page.getByLabel("Name").fill(o.name);
  await page.getByLabel("Email").fill(o.email);
  await page.getByLabel("Temporary password").fill(TEMP);
  await page.getByRole("combobox", { name: "Role" }).click();
  await page.getByRole("option", { name: o.role, exact: true }).click();
  await page.getByRole("combobox", { name: "Branch" }).click();
  await page.getByRole("option", { name: o.branch, exact: true }).click();
  await page.getByRole("button", { name: "Add user" }).click();
  await expect(userRow(page, o.email)).toContainText(o.branch);
}

/** A separate person: signs in with the temporary password, picks their own, lands on `landing`. */
async function landsOnPortal(
  browser: Browser,
  page: Page,
  who: { base: string; email: string; landing: RegExp; name: string },
): Promise<void> {
  const context = await browser.newContext({
    baseURL: who.base,
    viewport: page.viewportSize(),
  });
  const mine = await context.newPage();
  await mine.goto("/sign-in");
  await signInUI(mine, who.email, TEMP);
  await expect(mine).toHaveURL(/\/set-password$/);
  await setPasswordUI(mine, OWN);
  await expect(mine).toHaveURL(who.landing);
  await expectLabelled(mine, mine.url());
  await shot(mine, who.name);
  await context.close();
}

/** The owner's very first sign-in: one-time password, own password, "Add your first branch". */
async function ownerFirstRun(page: Page, firstBranch: string): Promise<void> {
  const { email, oneTimePassword } = adminCredentials();
  await page.goto("/sign-in");
  await expect(page.getByText("Forgot your password? Ask your admin to reset it.")).toBeVisible();
  await signInUI(page, email, oneTimePassword);
  await expect(page).toHaveURL(/\/set-password$/);
  await setPasswordUI(page, E2E_ADMIN_NEW_PASSWORD);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

  // Only the question set and one admin exist: the overview offers "Add your first branch".
  const card = page.getByRole("link", { name: "Add your first branch" });
  await expect(card).toBeVisible();
  const original = page.viewportSize() ?? { width: 360, height: 780 };
  for (const size of [
    { width: 360, height: 780 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(size);
    await expectNoDemo(page, "first-run overview");
    await shot(page, "admin-overview-first-run");
  }
  await page.setViewportSize(original);
  await card.click();
  await expect(page).toHaveURL(/\/admin\/branches$/);
  await addBranch(page, firstBranch);
}

/** The one-time password no longer opens the account. */
async function oneTimePasswordIsDead(playwright: Playwright, base: string): Promise<void> {
  const { email, oneTimePassword } = adminCredentials();
  const request = await playwright.request.newContext({ baseURL: base });
  await expect(
    rpcCall({ request, origin: new URL(base).origin }, "auth", "signIn", [email, oneTimePassword]),
  ).rejects.toThrow(/BAD_CREDENTIALS|incorrect/i);
  await request.dispose();
}

async function branchIdOf(page: Page, name: string): Promise<string> {
  const href = await branchRow(page, name).getByRole("link").first().getAttribute("href");
  return String(href).split("/").pop() ?? "";
}

test.describe("T-11b DoD 1-2: launch day on a fresh server", () => {
  test("test_s16_first_admin_sets_password_adds_branches_staff_and_each_lands_on_their_portal (S-16, DoD 1-2)", async ({
    page,
    browser,
    playwright,
    baseURL,
  }) => {
    test.setTimeout(240_000);
    const base = String(baseURL);
    const tag = `${width(page)}${uniq()}`;
    const velachery = `Velachery ${tag}`;
    const tambaram = `Tambaram ${tag}`;

    // Whichever project gets here first plays the owner's very first sign-in in the browser; the other
    // project finds the password already set and joins in with the shared admin session.
    const performed = await switchAdminPasswordOnce(() => ownerFirstRun(page, velachery));
    if (performed) await oneTimePasswordIsDead(playwright, base);
    else await sharedAdminInBrowser(page, playwright, base);

    await page.goto("/admin/branches");
    await expect(page.getByRole("heading", { name: "Branches" })).toBeVisible();
    if (!performed) await addBranch(page, velachery);
    await addBranch(page, tambaram);
    await shot(page, "s16-two-branches");

    // Each branch gets an advisor.
    for (const [name, advisor] of [
      [velachery, "Suresh"],
      [tambaram, "Karthik"],
    ] as const) {
      await page.goto("/admin/branches");
      await addAdvisor(page, await branchIdOf(page, name), advisor);
    }

    // ... and a branch admin and a support user.
    await page.goto("/admin/users");
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
    const people: { email: string; role: "Branch admin" | "Support" }[] = [];
    for (const [branch, who] of [
      [velachery, "vel"],
      [tambaram, "tam"],
    ] as const) {
      for (const role of ["Branch admin", "Support"] as const) {
        const email = `${who}.${role === "Support" ? "sup" : "adm"}.${tag}@ch.in`;
        await addUser(page, { name: `${who} ${role}`, email, role, branch });
        people.push({ email, role });
      }
    }
    await shot(page, "s16-four-users");

    // Everyone signs in on their own, is forced to choose a password, and lands on their portal.
    for (const p of people) {
      const support = p.role === "Support";
      await landsOnPortal(browser, page, {
        base,
        email: p.email,
        landing: support ? /\/support$/ : /\/admin$/,
        name: `s16-landing-${support ? "support" : "branch-admin"}-${p.email.slice(0, 3)}`,
      });
    }
  });
});
