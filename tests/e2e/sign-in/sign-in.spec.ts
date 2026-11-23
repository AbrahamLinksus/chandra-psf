import { expect, test } from "@playwright/test";

test.describe("T-01b sign-in is email + password only", () => {
  test("/ redirects to /sign-in with no picker, hint, demo label or reset", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("combobox")).toHaveCount(0);
    await expect(page.getByText(/Demo/i)).toHaveCount(0);
    await expect(page.getByText(/Reset/i)).toHaveCount(0);
    await page.screenshot({
      path: `.results/T-01b/sign-in-${String(page.viewportSize()?.width)}.png`,
    });
  });

  test("a wrong password is refused and keeps you on /sign-in", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill("nobody@example.com");
    await page.getByLabel("Password").fill("wrong-password-1");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test("/support/new without a session goes to /sign-in", async ({ page }) => {
    await page.goto("/support/new");
    await expect(page).toHaveURL(/\/sign-in$/);
  });
});
