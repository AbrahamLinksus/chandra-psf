/* eslint-disable max-lines-per-function -- describe blocks group many one-line tests */
import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "../../support/e2e";

const width = (page: Page): string => String(page.viewportSize()?.width);
const row = (page: Page, email: string) => page.locator(`li[data-user-email="${email}"]`);

async function stored(page: Page, key: string): Promise<string> {
  return page.evaluate((k) => window.localStorage.getItem(`psf:v1:${k}`) ?? "", key);
}

async function openUsers(page: Page, search = ""): Promise<void> {
  await signInAs(page, "admin");
  await page.goto(`/admin/users${search}`);
  await expect(page.getByRole("heading", { name: "Support users" })).toBeVisible();
}

async function addUser(page: Page, name: string, email: string, pw: string): Promise<void> {
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Temporary password").fill(pw);
  await page.getByRole("button", { name: "Add support user" }).click();
}

async function signOutToPicker(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.localStorage.removeItem("psf:v1:session");
  });
  await page.goto("/sign-in");
}

test.describe("T-10 manage support users", () => {
  test("s15 adds Deepa, rejects a duplicate, deactivates Support 2, Deepa signs in and sets her password", async ({
    page,
  }) => {
    await openUsers(page);
    await addUser(page, "Deepa R.", "deepa@chandrahonda.demo", "Welcome@1");
    await expect(row(page, "deepa@chandrahonda.demo")).toContainText("Deepa R.");
    expect(await stored(page, "audit")).toContain("user.create");
    await expect(page.getByLabel("Name")).toHaveValue("");
    await page.screenshot({ path: `.results/T-10/added-${width(page)}.png` });

    await addUser(page, "Another", "SUPPORT1@chandrahonda.demo", "Welcome@1");
    await expect(page.getByText("Email already in use")).toBeVisible();
    await expect(page.getByLabel("Name")).toHaveValue("Another");

    await row(page, "support2@chandrahonda.demo")
      .getByRole("button", { name: "Deactivate" })
      .click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Deactivate" }).click();
    await expect(row(page, "support2@chandrahonda.demo")).toContainText("Inactive");
    expect(await stored(page, "audit")).toContain("user.deactivate");
    await page.screenshot({ path: `.results/T-10/deactivated-${width(page)}.png` });

    await signOutToPicker(page);
    await page.getByLabel("Email").fill("deepa@chandrahonda.demo");
    await page.getByLabel("Password").fill("Welcome@1");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/set-password$/);
    await expect(page.getByRole("heading", { name: "Set your password" })).toBeVisible();
    await page.getByLabel("New password", { exact: true }).fill("MyOwnPass1");
    await page.getByLabel("Confirm password").fill("MyOwnPass1");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(/\/support$/);
  });

  test("empty name, invalid email and a 7-character password are rejected with the form kept (G-05)", async ({
    page,
  }) => {
    await openUsers(page);
    await addUser(page, "", "bad", "1234567");
    await expect(page.getByText("Enter a name")).toBeVisible();
    await expect(page.getByText("Enter a valid email address")).toBeVisible();
    await expect(page.getByText("Use at least 8 characters")).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveValue("bad");
    expect(await stored(page, "audit")).not.toContain("user.create");
  });

  test("s15 a deactivated user sees 'Account disabled, contact admin'; reactivate restores access; admin has no deactivate on themself", async ({
    page,
  }) => {
    await openUsers(page);
    await expect(row(page, "admin@chandrahonda.demo").getByRole("button")).toHaveCount(0);
    await row(page, "support2@chandrahonda.demo")
      .getByRole("button", { name: "Deactivate" })
      .click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Deactivate" }).click();
    await expect(row(page, "support2@chandrahonda.demo")).toContainText("Inactive");

    // A second tab (no init script) plays Support 2's browser: his stored session is dropped.
    const s2 = await page.context().newPage();
    await s2.goto("/sign-in");
    await s2.evaluate(() => {
      window.localStorage.setItem("psf:v1:session", JSON.stringify({ userId: "u-support2" }));
    });
    await s2.goto("/support");
    await expect(s2).toHaveURL(/\/sign-in$/);
    await s2.getByRole("button", { name: "Sign in as Support 2" }).click();
    await expect(s2.getByText("Account disabled, contact admin")).toBeVisible();
    await s2.screenshot({ path: `.results/T-10/disabled-${width(page)}.png` });

    await page.goto("/admin/users");
    await row(page, "support2@chandrahonda.demo")
      .getByRole("button", { name: "Reactivate" })
      .click();
    await expect(row(page, "support2@chandrahonda.demo")).toContainText("Active");
    expect(await stored(page, "audit")).toContain("user.reactivate");

    await s2.goto("/sign-in");
    await s2.getByRole("button", { name: "Sign in as Support 2" }).click();
    await expect(s2).toHaveURL(/\/support$/);
  });

  test("s13 a failed save keeps the form and shows Couldn't save, try again (S-13)", async ({
    page,
  }) => {
    await openUsers(page, "?demoFail=1");
    await addUser(page, "Deepa R.", "deepa@chandrahonda.demo", "Welcome@1");
    await expect(page.getByText("Couldn't save, try again")).toBeVisible();
    await expect(page.getByLabel("Name")).toHaveValue("Deepa R.");
    await expect(page.getByLabel("Email")).toHaveValue("deepa@chandrahonda.demo");
    expect(await stored(page, "users")).not.toContain("deepa@");
    await page.screenshot({ path: `.results/T-10/save-failed-${width(page)}.png` });
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(row(page, "deepa@chandrahonda.demo")).toBeVisible();
  });

  test("D-15: a support session opening /admin/users goes to /not-allowed with no user data", async ({
    page,
  }) => {
    await signInAs(page, "support1");
    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/not-allowed$/);
    await expect(page.getByText("You don't have access to this page")).toBeVisible();
    await expect(page.getByText("support2@chandrahonda.demo")).toHaveCount(0);
  });
});
