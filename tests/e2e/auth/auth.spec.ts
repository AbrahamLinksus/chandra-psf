/* eslint-disable max-lines-per-function -- describe blocks group many one-line tests */
import { expect, test, type Page } from "@playwright/test";
import {
  E2E_ADMIN_NEW_PASSWORD,
  adminApi,
  adminCredentials,
  adminSessionInBrowser,
  endSessionOnServer,
  rpcCall,
  switchAdminPasswordOnce,
} from "../../support/e2e";

const isDesktop = (page: Page): boolean => (page.viewportSize()?.width ?? 0) >= 768;
const width = (page: Page): string => String(page.viewportSize()?.width);

async function signInWith(page: Page, email: string, password: string): Promise<void> {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

/**
 * Signs in as the shared e2e admin. Other workers sign in as the same admin at the same time and an
 * in-flight attempt counts toward the lock, so a "Too many attempts" alert here is a collision between
 * our own workers: wait and submit again. Anything else (wrong password, a page change) is not retried.
 */
async function signInAsAdmin(page: Page): Promise<void> {
  const limited = page.getByText("Too many attempts. Try again in 15 minutes.");
  for (let attempt = 1; attempt <= 12; attempt++) {
    await signInWith(page, adminCredentials().email, E2E_ADMIN_NEW_PASSWORD);
    const outcome = await Promise.race([
      limited.waitFor({ timeout: 8000 }).then(() => "limited" as const),
      page
        .waitForURL((u) => !u.pathname.startsWith("/sign-in"), { timeout: 8000 })
        .then(() => "in" as const),
    ]).catch(() => "other" as const);
    if (outcome !== "limited") return;
    await page.waitForTimeout(300 + Math.random() * 700);
  }
}

/** Opens the admin "More" sheet on phones; on desktop the actions live in the sidebar. */
async function adminSignOut(page: Page): Promise<void> {
  if (!isDesktop(page)) await page.getByRole("button", { name: "More" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
}

test.describe("T-02b staff sign-in, set password, sign-out on the server", () => {
  // The one-time password works once per run (both browser projects share one database), so
  // whichever project gets here first plays the whole first-admin flow; the other one skips it.
  test("test_s16_first_admin_one_time_password_then_set_password_then_admin (S-16, G-14)", async ({
    page,
  }) => {
    const { email, oneTimePassword } = adminCredentials();
    const performed = await switchAdminPasswordOnce(async () => {
      await page.goto("/sign-in");
      await signInWith(page, email, oneTimePassword);
      await expect(page).toHaveURL(/\/set-password$/);
      await expect(page.getByRole("heading", { name: "Set your password" })).toBeVisible();
      await page.screenshot({ path: `.results/T-02b/set-password-${width(page)}.png` });

      const fill = async (pw: string, confirm: string) => {
        await page.getByLabel("New password", { exact: true }).fill(pw);
        await page.getByLabel("Confirm password").fill(confirm);
        await page.getByRole("button", { name: "Save" }).click();
      };
      await fill("short", "short");
      await expect(page.locator("main [role=alert]")).toHaveText("Use at least 8 characters");
      await fill("password", "password");
      await expect(page.locator("main [role=alert]")).toContainText("That password is too common");
      await fill(E2E_ADMIN_NEW_PASSWORD, "something-else-entirely");
      await expect(page.getByText("The two passwords don't match")).toBeVisible();
      await expect(page).toHaveURL(/\/set-password$/);

      await fill(E2E_ADMIN_NEW_PASSWORD, E2E_ADMIN_NEW_PASSWORD);
      await expect(page).toHaveURL(/\/admin$/);
      await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    });
    test.skip(!performed, "the one-time password was already replaced by the other project");

    // The old one-time password no longer opens the account.
    await adminSignOut(page);
    await expect(page).toHaveURL(/\/sign-in$/);
    await signInWith(page, email, oneTimePassword);
    await expect(page.locator("main [role=alert]")).toHaveText("Email or password is incorrect");
  });

  test("a wrong password and an unknown email show the same message and stay on sign-in (S-18, G-2)", async ({
    page,
    playwright,
    baseURL,
  }) => {
    await adminApi(playwright, String(baseURL));
    await page.goto("/sign-in");
    await expect(page.getByText("Forgot your password? Ask your admin to reset it.")).toBeVisible();
    await signInWith(page, adminCredentials().email, "wrong-password-1");
    await expect(page.locator("main [role=alert]")).toHaveText("Email or password is incorrect");
    await expect(page).toHaveURL(/\/sign-in$/);
    await page.screenshot({ path: `.results/T-02b/wrong-password-${width(page)}.png` });

    await signInWith(page, "nobody.here@e2e.test", "wrong-password-1");
    await expect(page.locator("main [role=alert]")).toHaveText("Email or password is incorrect");
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test("the admin signs in with the chosen password, lands on /admin, and Sign out ends the session on the server (G-W1)", async ({
    page,
    playwright,
    baseURL,
  }) => {
    await adminApi(playwright, String(baseURL));
    await page.goto("/sign-in");
    await signInAsAdmin(page);
    await expect(page).toHaveURL(/\/admin$/);

    const cookies = await page.context().cookies();
    const cookie = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    await adminSignOut(page);
    await expect(page).toHaveURL(/\/sign-in$/);

    // Replaying the old cookie proves the server row is gone, not just the browser cookie.
    const replay = await playwright.request.newContext({
      baseURL: String(baseURL),
      extraHTTPHeaders: { cookie, origin: new URL(String(baseURL)).origin },
    });
    const me = await replay.post("/api/rpc/auth/currentUser", { data: { args: [] } });
    expect(await me.json()).toEqual({ ok: true, value: null });
    await replay.dispose();

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fadmin$/);
  });

  test("without a cookie /admin, /support and /account go to /sign-in?next= (AC-6)", async ({
    page,
  }) => {
    for (const path of ["/admin/users", "/support/new", "/account", "/admin"]) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/sign-in\\?next=${encodeURIComponent(path)}$`));
    }
  });

  test("after the session ends the next action says so and returns to the same page after sign-in (AC-6)", async ({
    page,
    playwright,
    baseURL,
  }) => {
    await adminSessionInBrowser(page, playwright, String(baseURL));
    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/admin\/users$/);

    await endSessionOnServer(page, playwright, String(baseURL));
    await page.reload();
    await expect(page).toHaveURL(/\/sign-in\?ended=1&next=%2Fadmin%2Fusers$/);
    await expect(page.getByText("Your session has ended. Sign in again.")).toBeVisible();
    await page.screenshot({ path: `.results/T-02b/sign-in-ended-${width(page)}.png` });

    await signInAsAdmin(page);
    await expect(page).toHaveURL(/\/admin\/users$/);
  });

  test("RPC: after sign-out a staff call answers UNAUTHENTICATED with the session-ended message", async ({
    playwright,
    baseURL,
  }) => {
    const api = await adminApi(playwright, String(baseURL));
    await api.request.post("/api/rpc/auth/signOut", {
      headers: { origin: api.origin },
      data: { args: [] },
    });
    await expect(rpcCall(api, "auth", "setOwnPassword", ["Another-Pass-42"])).rejects.toThrow(
      /UNAUTHENTICATED Your session has ended. Sign in again./,
    );
  });
});
