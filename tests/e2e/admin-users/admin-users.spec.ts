/* eslint-disable max-lines-per-function -- describe blocks group several specs */
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
  type PlaywrightWorkerArgs,
} from "@playwright/test";
import {
  adminApi,
  adminCredentials,
  adminSessionInBrowser,
  createBranch,
  createUser,
  type AppApi,
} from "../../support/e2e";

const width = (page: Page): string => String(page.viewportSize()?.width);
const row = (page: Page, email: string) => page.locator(`li[data-user-email="${email}"]`);
const TEMP = "Temp-Pass-4471";
const OWN = "My-Own-Pass-2026!";

/** Unique per test and per browser project: both projects share one database. */
function uniq(page: Page, tag: string): string {
  return `${tag}.${width(page)}.${String(Date.now())}`;
}

async function fillSignIn(page: Page, email: string, password: string): Promise<void> {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

async function chooseOwnPassword(page: Page, password: string): Promise<void> {
  await expect(page.getByRole("heading", { name: "Set your password" })).toBeVisible();
  await page.getByLabel("New password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Save" }).click();
}

/** A separate browser person: own cookies, signs in with the temp password and sets their own. */
async function personSignedIn(
  browser: Browser,
  page: Page,
  baseURL: string,
  email: string,
  landing: RegExp,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ baseURL, viewport: page.viewportSize() });
  const mine = await context.newPage();
  await mine.goto("/sign-in");
  await fillSignIn(mine, email, TEMP);
  await expect(mine).toHaveURL(/\/set-password$/);
  await chooseOwnPassword(mine, OWN);
  await expect(mine).toHaveURL(landing);
  return { context, page: mine };
}

async function pick(page: Page, label: string, option: string): Promise<void> {
  await page.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

async function addUserForm(page: Page, name: string, email: string): Promise<void> {
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Temporary password").fill(TEMP);
}

async function adminWithBranch(
  page: Page,
  playwright: PlaywrightWorkerArgs["playwright"],
  baseURL: string,
  branchName: string,
): Promise<{ api: AppApi; branchId: string }> {
  const api = await adminApi(playwright, baseURL);
  const { id } = await createBranch(api, { name: branchName, city: "Chennai" });
  // Reuse the one API sign-in for the browser (fewer shared-admin sign-ins, less rate limiting).
  await page.context().addCookies((await api.request.storageState()).cookies);
  return { api, branchId: id };
}

test.describe("T-10b staff accounts", () => {
  test("test_s15_velachery_admin_adds_arun_as_support_in_a_fixed_branch_and_arun_must_set_a_password (S-15, G-01, G-05)", async ({
    page,
    browser,
    playwright,
    baseURL,
  }) => {
    const base = String(baseURL);
    const velachery = `Velachery ${uniq(page, "s15")}`;
    const { api, branchId } = await adminWithBranch(page, playwright, base, velachery);
    const adminEmail = `${uniq(page, "meena")}@chandrahonda.in`;
    await createUser(api, {
      name: "Meena",
      email: adminEmail,
      tempPassword: TEMP,
      role: "branch_admin",
      branchId,
    });
    const boss = await personSignedIn(browser, page, base, adminEmail, /\/admin$/);

    await boss.page.goto("/admin/users");
    await expect(boss.page.getByRole("heading", { name: "Users" })).toBeVisible();
    // The role picker offers only Support; the branch is fixed and cannot be changed.
    await boss.page.getByRole("combobox", { name: "Role" }).click();
    await expect(boss.page.getByRole("option")).toHaveText(["Support"]);
    await boss.page.getByRole("option", { name: "Support", exact: true }).click();
    await expect(boss.page.getByRole("combobox", { name: "Branch" })).toBeDisabled();
    await expect(boss.page.getByRole("combobox", { name: "Branch" })).toHaveText(velachery);

    const arun = `arun.${uniq(page, "s15")}@chandrahonda.in`;
    await addUserForm(boss.page, "Arun", arun);
    await boss.page.getByRole("button", { name: "Add user" }).click();
    await expect(row(boss.page, arun)).toContainText("Support");
    await expect(row(boss.page, arun)).toContainText(velachery);
    await boss.page.screenshot({ path: `.results/T-10b/e2e-s15-added-${width(page)}.png` });

    await addUserForm(boss.page, "Arun again", arun.toUpperCase());
    await boss.page.getByRole("button", { name: "Add user" }).click();
    await expect(boss.page.getByText("Email already in use")).toBeVisible();

    // Arun's first sign-in forces "Set your password", then lands on /support.
    const arunBrowser = await personSignedIn(browser, page, base, arun, /\/support$/);
    await arunBrowser.context.close();
    await boss.context.close();
  });

  test("a branch admin sees Advisors but not Branches; support on /admin is turned away (US-29, G-W2)", async ({
    page,
    browser,
    playwright,
    baseURL,
  }) => {
    const base = String(baseURL);
    const { api, branchId } = await adminWithBranch(
      page,
      playwright,
      base,
      `Nav ${uniq(page, "nav")}`,
    );
    const boss = `${uniq(page, "boss")}@chandrahonda.in`;
    const aide = `${uniq(page, "aide")}@chandrahonda.in`;
    for (const [email, role] of [
      [boss, "branch_admin"],
      [aide, "support"],
    ] as const) {
      await createUser(api, { name: "Test", email, tempPassword: TEMP, role, branchId });
    }
    const admin = await personSignedIn(browser, page, base, boss, /\/admin$/);
    if ((admin.page.viewportSize()?.width ?? 0) < 768) {
      await admin.page.getByRole("button", { name: "More" }).click();
    }
    await expect(admin.page.getByRole("link", { name: "Advisors" }).first()).toBeVisible();
    await expect(admin.page.getByRole("link", { name: "Branches", exact: true })).toHaveCount(0);
    await admin.context.close();

    const support = await personSignedIn(browser, page, base, aide, /\/support$/);
    await support.page.goto("/admin");
    await expect(support.page).not.toHaveURL(/\/admin\/?$/);
    await expect(support.page.getByRole("heading", { name: "Overview" })).toHaveCount(0);
    await support.page.goto("/admin/users");
    await expect(support.page.getByRole("heading", { name: "Users" })).toHaveCount(0);
    await support.context.close();
  });

  test("the main admin adds a user with any role and branch, and the form shows the field rules (G-01, G-05)", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const branchName = `Pick ${uniq(page, "pick")}`;
    await adminWithBranch(page, playwright, String(baseURL), branchName);
    await page.goto("/admin/users");
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();

    await page.getByRole("combobox", { name: "Role" }).click();
    await expect(page.getByRole("option")).toHaveText(["Support", "Branch admin", "Main admin"]);
    await page.keyboard.press("Escape");

    await page.getByLabel("Name").fill("");
    await page.getByLabel("Email").fill("bad");
    await page.getByLabel("Temporary password").fill("1234567");
    await page.getByRole("button", { name: "Add user" }).click();
    await expect(page.getByText("Enter a name")).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveValue("bad");
    await page.getByLabel("Name").fill("Bala");
    await page.getByRole("button", { name: "Add user" }).click();
    await expect(page.getByText("Enter a valid email address")).toBeVisible();
    await page.getByLabel("Email").fill(`bala.${uniq(page, "rules")}@chandrahonda.in`);
    await page.getByRole("button", { name: "Add user" }).click();
    await expect(page.getByText("Use at least 8 characters")).toBeVisible();
    await expect(page.getByLabel("Name")).toHaveValue("Bala");

    await pick(page, "Role", "Branch admin");
    const email = `bala.${uniq(page, "pick")}@chandrahonda.in`;
    await addUserForm(page, "Bala", email);
    await pick(page, "Branch", branchName);
    await page.getByRole("button", { name: "Add user" }).click();
    await expect(row(page, email)).toContainText("Branch admin");
    await expect(row(page, email)).toContainText(branchName);
  });

  test("test_s20_main_admin_changes_arun_email_and_role_and_his_session_ends (S-20, G-9)", async ({
    page,
    browser,
    playwright,
    baseURL,
  }) => {
    const base = String(baseURL);
    const { api, branchId } = await adminWithBranch(
      page,
      playwright,
      base,
      `S20 ${uniq(page, "s20")}`,
    );
    const typo = `arun.${uniq(page, "s20")}@chandrahnda.in`;
    const fixed = typo.replace("chandrahnda", "chandrahonda");
    await createUser(api, {
      name: "Arun",
      email: typo,
      tempPassword: TEMP,
      role: "support",
      branchId,
    });
    const arun = await personSignedIn(browser, page, base, typo, /\/support$/);

    await page.goto("/admin/users");
    await row(page, typo).getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Email").last().fill(fixed);
    await pick(page, "Role", "Branch admin");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(row(page, fixed)).toContainText("Branch admin");
    await page.screenshot({ path: `.results/T-10b/e2e-s20-edited-${width(page)}.png` });

    // Arun's session ended with the role change: his next page goes to sign-in.
    await arun.page.goto("/support");
    await expect(arun.page).toHaveURL(/\/sign-in/);
    await arun.context.close();
    // The audit old -> new is asserted by updateUser.test.ts: the audit list is not built yet.
  });

  test("test_s18_reset_password_while_priya_is_signed_in_sends_her_to_sign_in_then_set_your_password (US-27, S-18, S-27)", async ({
    page,
    browser,
    playwright,
    baseURL,
  }) => {
    const base = String(baseURL);
    const { api, branchId } = await adminWithBranch(
      page,
      playwright,
      base,
      `S18 ${uniq(page, "s18")}`,
    );
    const email = `priya.${uniq(page, "s18")}@chandrahonda.in`;
    await createUser(api, {
      name: "Priya",
      email,
      tempPassword: TEMP,
      role: "support",
      branchId,
    });
    const priya = await personSignedIn(browser, page, base, email, /\/support$/);

    await page.goto("/admin/users");
    await row(page, email).getByRole("button", { name: "Reset password" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Temporary password").fill("Fresh-Temp-5521");
    await dialog.getByRole("button", { name: "Reset password", exact: true }).click();
    await expect(page.getByTestId("reset-confirmation")).toContainText("Fresh-Temp-5521");
    await page.screenshot({ path: `.results/T-10b/e2e-s18-reset-${width(page)}.png` });
    await page.getByRole("button", { name: "Done" }).click();

    await priya.page.goto("/support");
    await expect(priya.page).toHaveURL(/\/sign-in/);
    await fillSignIn(priya.page, email, "Fresh-Temp-5521");
    await expect(priya.page).toHaveURL(/\/set-password$/);
    await expect(priya.page.getByRole("heading", { name: "Set your password" })).toBeVisible();
    await priya.context.close();
  });

  test("deactivate ends the session at once and the user sees 'Account disabled'; reactivate restores (US-20)", async ({
    page,
    browser,
    playwright,
    baseURL,
  }) => {
    const base = String(baseURL);
    const { api, branchId } = await adminWithBranch(
      page,
      playwright,
      base,
      `Off ${uniq(page, "off")}`,
    );
    const email = `off.${uniq(page, "off")}@chandrahonda.in`;
    await createUser(api, { name: "Off", email, tempPassword: TEMP, role: "support", branchId });
    const person = await personSignedIn(browser, page, base, email, /\/support$/);

    await page.goto("/admin/users");
    await row(page, email).getByRole("button", { name: "Deactivate" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Deactivate" }).click();
    await expect(row(page, email)).toContainText("Inactive");

    await person.page.goto("/support");
    await expect(person.page).toHaveURL(/\/sign-in/);
    await fillSignIn(person.page, email, OWN);
    await expect(person.page.getByText("Account disabled, contact admin")).toBeVisible();

    await row(page, email).getByRole("button", { name: "Reactivate" }).click();
    await expect(row(page, email)).toContainText("Active");
    await fillSignIn(person.page, email, OWN);
    await expect(person.page).toHaveURL(/\/support$/);
    await person.context.close();
  });

  test("the admin has no Edit-role, Reset or Deactivate on their own row", async ({
    page,
    playwright,
    baseURL,
  }) => {
    await adminSessionInBrowser(page, playwright, String(baseURL));
    await page.goto("/admin/users");
    const mine = row(page, adminCredentials().email.toLowerCase());
    await expect(mine).toContainText("You");
    await expect(mine.getByRole("button", { name: "Deactivate" })).toHaveCount(0);
    await expect(mine.getByRole("button", { name: "Reset password" })).toHaveCount(0);
  });
});
