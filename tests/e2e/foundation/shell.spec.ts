/* eslint-disable max-lines-per-function -- describe blocks group many one-line tests */
import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "../../support/e2e";

const NAV: [string, string][] = [
  ["/admin", "Overview"],
  ["/admin/alerts", "Alerts"],
  ["/admin/responses", "Responses"],
  ["/admin/responses/deleted", "Recently deleted"],
  ["/admin/audit", "Audit"],
  ["/admin/users", "Users"],
];

const isDesktop = (page: Page): boolean => (page.viewportSize()?.width ?? 0) >= 768;

// Phase-1 demo spec: it signs in through browser storage, which no longer exists. Rebuilt on the server by T-02b.
test.fixme(true, "rebuilt by T-02b");

test.describe("T-01 routing and shell", () => {
  test("AC-1 / redirects to /sign-in, a placeholder with the Demo label", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(page.getByText("Demo — sample data")).toBeVisible();
    await page.screenshot({
      path: `.results/T-01/sign-in-${String(page.viewportSize()?.width)}.png`,
    });
  });

  test("AC-1 / admin session sees the AdminShell (sidebar >= md, tab bar below)", async ({
    page,
  }) => {
    await signInAs(page, "admin");
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    const sidebar = page.getByRole("navigation", { name: "Admin", exact: true });
    const tabs = page.getByRole("navigation", { name: "Admin tabs" });
    if (isDesktop(page)) {
      await expect(sidebar).toBeVisible();
      await expect(tabs).toBeHidden();
    } else {
      await expect(tabs).toBeVisible();
      await expect(sidebar).toBeHidden();
    }
    await page.screenshot({
      path: `.results/T-01/admin-${String(page.viewportSize()?.width)}.png`,
    });
  });

  test("AC-1 / every admin nav item opens a placeholder page", async ({ page }) => {
    await signInAs(page, "admin");
    await page.goto("/admin");
    for (const [href, label] of NAV) {
      if (!isDesktop(page)) {
        const tab = page
          .getByRole("navigation", { name: "Admin tabs" })
          .getByRole("link", { name: label });
        if ((await tab.count()) === 0) {
          await page.getByRole("button", { name: "More" }).click();
          await page.getByRole("dialog").getByRole("link", { name: label }).click();
        } else {
          await tab.click();
        }
      } else {
        await page
          .getByRole("navigation", { name: "Admin", exact: true })
          .getByRole("link", { name: label })
          .click();
      }
      await expect(page).toHaveURL(new RegExp(`${href}$`));
      await expect(page.getByRole("heading", { name: label }).first()).toBeVisible();
    }
  });

  test("AC-1 / session and data survive a reload (G-02)", async ({ page }) => {
    await signInAs(page, "admin");
    await page.goto("/admin/alerts");
    await page.reload();
    await expect(page).toHaveURL(/\/admin\/alerts$/);
    await expect(page.getByRole("heading", { name: "Alerts" })).toBeVisible();
  });

  test("AC-1 / a support session on /admin is told it has no access", async ({ page }) => {
    await signInAs(page, "support1");
    await page.goto("/admin");
    await expect(page.getByText("You don't have access to this page")).toBeVisible();
    await page.screenshot({
      path: `.results/T-01/not-allowed-${String(page.viewportSize()?.width)}.png`,
    });
  });

  test("AC-1 / no session on /admin goes to /sign-in", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test("AC-1 (G-W7) / unknown URL shows a friendly not-found page without a stack trace", async ({
    page,
  }) => {
    const res = await page.goto("/no/such/page");
    expect(res?.status()).toBe(404);
    await expect(page.getByText("We couldn't find that page")).toBeVisible();
    const body = (await page.locator("body").innerText()).toLowerCase();
    expect(body).not.toMatch(/stack|at .*\.(tsx?|jsx?):\d+|typeerror|referenceerror/);
    await page.screenshot({
      path: `.results/T-01/not-found-${String(page.viewportSize()?.width)}.png`,
    });
  });

  test("AC-5 / robots.txt disallows all and pages carry noindex", async ({ page, request }) => {
    const robots = await request.get("/robots.txt");
    const text = await robots.text();
    expect(text).toMatch(/User-Agent: \*/i);
    expect(text).toMatch(/Disallow: \//);
    await page.goto("/sign-in");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });
});
