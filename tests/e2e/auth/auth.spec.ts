/* eslint-disable max-lines-per-function -- describe blocks group many one-line tests */
import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "../../support/e2e";

const DEMO_PASSWORD = "Demo@2026";
const isDesktop = (page: Page): boolean => (page.viewportSize()?.width ?? 0) >= 768;

/** Opens the admin "More" sheet on phones; on desktop the actions live in the sidebar. */
async function adminAction(page: Page, name: string): Promise<void> {
  if (!isDesktop(page)) await page.getByRole("button", { name: "More" }).click();
  await page.getByRole("button", { name }).click();
}

/** Edits the stored users before sign-in (test support: no seeded user needs a new password). */
async function patchUser(page: Page, id: string, patch: Record<string, unknown>): Promise<void> {
  await page.goto("/sign-in");
  await expect(page.getByRole("button", { name: "Sign in as Admin" })).toBeVisible();
  await page.evaluate(
    ([userId, changes]) => {
      const key = "psf:v1:users";
      const users = JSON.parse(window.localStorage.getItem(key) ?? "[]") as { id: string }[];
      const next = users.map((u) => (u.id === userId ? { ...u, ...(changes as object) } : u));
      window.localStorage.setItem(key, JSON.stringify(next));
    },
    [id, patch] as const,
  );
  await page.reload();
}

test.describe("T-02 sign in, set password, reset demo", () => {
  test("the sign-in picker lands Support 1 on /support and Admin on /admin", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByRole("button", { name: "Sign in as Support 1" }).click();
    await expect(page).toHaveURL(/\/support$/);
    await page.screenshot({
      path: `.results/T-02/support-${String(page.viewportSize()?.width)}.png`,
    });
    await page.evaluate(() => {
      window.localStorage.removeItem("psf:v1:session");
    });
    await page.goto("/sign-in");
    await page.getByRole("button", { name: "Sign in as Admin" }).click();
    await expect(page).toHaveURL(/\/admin$/);
  });

  test("the demo password hint is shown and signs in support1 by email (G-01)", async ({
    page,
  }) => {
    await page.goto("/sign-in");
    await expect(page.getByText(DEMO_PASSWORD)).toBeVisible();
    await page.getByLabel("Email").fill("support1@chandrahonda.demo");
    await page.getByLabel("Password").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/support$/);
  });

  test("a wrong password shows 'Email or password is incorrect' and stays on sign-in", async ({
    page,
  }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill("support1@chandrahonda.demo");
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.locator("main [role=alert]")).toHaveText("Email or password is incorrect");
    await expect(page).toHaveURL(/\/sign-in$/);
    await page.screenshot({
      path: `.results/T-02/wrong-${String(page.viewportSize()?.width)}.png`,
    });
  });

  test("a deactivated user sees 'Account disabled, contact admin' (G-01)", async ({ page }) => {
    await patchUser(page, "u-support2", { active: false });
    await page.getByLabel("Email").fill("support2@chandrahonda.demo");
    await page.getByLabel("Password").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.locator("main [role=alert]")).toHaveText("Account disabled, contact admin");
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test("Sign out ends the session (G-W1)", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByRole("button", { name: "Sign in as Support 1" }).click();
    await expect(page).toHaveURL(/\/support$/);
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
    await page.goto("/support");
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test("regression M1: signing in after a guarded page cached a signed-out session lands on /support", async ({
    page,
  }) => {
    await page.goto("/support");
    await expect(page).toHaveURL(/\/sign-in$/);
    await page.getByRole("button", { name: "Sign in as Support 1" }).click();
    await expect(page).toHaveURL(/\/support$/);
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  });

  test("regression M1: signing out then signing in again lands on /support", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByRole("button", { name: "Sign in as Support 1" }).click();
    await expect(page).toHaveURL(/\/support$/);
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
    await page.getByRole("button", { name: "Sign in as Support 1" }).click();
    await expect(page).toHaveURL(/\/support$/);
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  });

  test("a user who must set a password is sent to 'Set your password' (G-05, S-15)", async ({
    page,
  }) => {
    await patchUser(page, "u-support1", { mustSetPassword: true });
    await page.getByRole("button", { name: "Sign in as Support 1" }).click();
    await expect(page).toHaveURL(/\/set-password$/);
    await expect(page.getByRole("heading", { name: "Set your password" })).toBeVisible();

    await page.getByLabel("New password", { exact: true }).fill("short");
    await page.getByLabel("Confirm password").fill("short");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.locator("main [role=alert]")).toHaveText("Use at least 8 characters");
    await expect(page).toHaveURL(/\/set-password$/);

    await page.getByLabel("New password", { exact: true }).fill("longenough1");
    await page.getByLabel("Confirm password").fill("different-one");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.locator("main [role=alert]")).toHaveText("The two passwords don't match");
    const stillFlagged = await page.evaluate(() => {
      const users = JSON.parse(window.localStorage.getItem("psf:v1:users") ?? "[]") as {
        id: string;
        mustSetPassword: boolean;
      }[];
      return users.find((u) => u.id === "u-support1")?.mustSetPassword;
    });
    expect(stillFlagged).toBe(true);
    await page.screenshot({
      path: `.results/T-02/set-password-${String(page.viewportSize()?.width)}.png`,
    });

    await page.getByLabel("Confirm password").fill("longenough1");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(/\/support$/);
    const audit = await page.evaluate(() => window.localStorage.getItem("psf:v1:audit") ?? "");
    expect(audit).toContain("user.set_password");
    expect(audit).not.toContain("longenough1");
  });

  test("S-06 / US-22: Reset demo data warns, cancel keeps data, confirm restores and signs out every tab", async ({
    page,
    context,
  }) => {
    await signInAs(page, "admin");
    await page.goto("/admin");
    const second = await context.newPage();
    await second.goto("/admin");
    await expect(second).toHaveURL(/\/admin$/);
    await page.evaluate(() => {
      window.localStorage.setItem("psf:v1:stray", "x");
    });

    await adminAction(page, "Reset demo data");
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText(
      "Reset all demo data? Every link, response, alert, user and audit entry made in this browser is lost.",
    );
    await page.screenshot({
      path: `.results/T-02/reset-${String(page.viewportSize()?.width)}.png`,
    });
    await dialog.getByRole("button", { name: "Cancel" }).click();
    expect(await page.evaluate(() => window.localStorage.getItem("psf:v1:stray"))).toBe("x");

    await adminAction(page, "Reset demo data");
    await page.getByRole("alertdialog").getByRole("button", { name: "Reset" }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(second).toHaveURL(/\/sign-in$/);
    expect(await page.evaluate(() => window.localStorage.getItem("psf:v1:stray"))).toBeNull();
    expect(await page.evaluate(() => window.localStorage.getItem("psf:v1:session"))).toBeNull();
  });

  test("the sign-in screen has its own Reset demo data link with the same warning", async ({
    page,
  }) => {
    await page.goto("/sign-in");
    await page.getByRole("button", { name: "Reset demo data" }).click();
    await expect(page.getByRole("alertdialog")).toContainText(
      "Every link, response, alert, user and audit entry",
    );
    await page.getByRole("alertdialog").getByRole("button", { name: "Reset" }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test("S-13: 'Simulate failed save' in More arms the next write to fail", async ({ page }) => {
    await signInAs(page, "admin");
    await page.goto("/admin");
    await adminAction(page, "Simulate failed save");
    await expect
      .poll(() => page.evaluate(() => window.sessionStorage.getItem("psf:fault")))
      .toBe("1");
  });
});
