/* eslint-disable max-lines-per-function -- describe blocks group many one-line tests */
import { expect, test, type Page } from "@playwright/test";
import {
  E2E_ADMIN_NEW_PASSWORD,
  adminApi,
  adminCredentials,
  adminSessionInBrowser,
  rpcCall,
} from "../../support/e2e";

const width = (page: Page): string => String(page.viewportSize()?.width);

async function signInWith(page: Page, email: string, password: string): Promise<void> {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

async function fillChange(page: Page, current: string, next: string, confirm: string) {
  await page.getByLabel("Current password").fill(current);
  await page.getByLabel("New password", { exact: true }).fill(next);
  await page.getByLabel("Confirm new password").fill(confirm);
  await page.getByRole("button", { name: "Change password" }).click();
}

test.describe("T-20 lockout, step-up, My account", () => {
  test("test_s27_sixth_wrong_password_shows_the_lockout_message (S-27, G-13)", async ({ page }) => {
    // A fresh unknown email: never the shared admin, so other tests are not locked out.
    const email = `lockout.${String(Date.now())}.${width(page)}@e2e.test`;
    await page.goto("/sign-in");
    for (let i = 0; i < 5; i++) {
      await signInWith(page, email, `wrong-password-${String(i)}`);
      await expect(page.locator("main [role=alert]")).toHaveText("Email or password is incorrect");
    }
    await signInWith(page, email, "wrong-password-6");
    await expect(page.locator("main [role=alert]")).toHaveText(
      "Too many attempts. Try again in 15 minutes.",
    );
    await expect(page).toHaveURL(/\/sign-in$/);
    await page.screenshot({ path: `.results/T-20/lockout-${width(page)}.png` });
  });

  test("My account shows name, email, role and branch (US-28)", async ({
    page,
    playwright,
    baseURL,
  }) => {
    await adminSessionInBrowser(page, playwright, String(baseURL));
    await page.goto("/account");
    await expect(page.getByRole("heading", { name: "My account" })).toBeVisible();
    const details = page.getByRole("region", { name: "Your details" });
    const me = await rpcCall<{ name: string }>(
      await adminApi(playwright, String(baseURL)),
      "auth",
      "currentUser",
      [],
    );
    await expect(details.getByText(me.name, { exact: true })).toBeVisible();
    await expect(details.getByText(adminCredentials().email, { exact: true })).toBeVisible();
    await expect(details.getByText("Main admin", { exact: true })).toBeVisible();
    await expect(details.getByText("All branches", { exact: true })).toBeVisible();
    await page.screenshot({ path: `.results/T-20/my-account-${width(page)}.png` });
  });

  test("change password: wrong current, weak new and too-common are refused (US-28)", async ({
    page,
    playwright,
    baseURL,
  }) => {
    await adminSessionInBrowser(page, playwright, String(baseURL));
    await page.goto("/account");

    await fillChange(page, "not-the-password-1", "Another-Pass-77!", "Another-Pass-77!");
    await expect(page.getByRole("alert").filter({ hasText: "Password incorrect" })).toBeVisible();

    await fillChange(page, E2E_ADMIN_NEW_PASSWORD, "short", "short");
    await expect(
      page.getByRole("alert").filter({ hasText: "Use at least 8 characters" }),
    ).toBeVisible();

    await fillChange(page, E2E_ADMIN_NEW_PASSWORD, "password", "password");
    await expect(page.getByRole("alert").filter({ hasText: "too common" })).toBeVisible();

    await page.screenshot({ path: `.results/T-20/change-password-errors-${width(page)}.png` });
  });

  // Success ends every other session of the account, which would sign the other workers out of the
  // shared admin. Needs a throwaway user (users helper, T-10b); the unit tests cover success meanwhile.
  test.fixme("change password success ends my other sessions (US-28)", () => undefined);
});
