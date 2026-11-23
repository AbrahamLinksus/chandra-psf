/* eslint-disable max-lines-per-function -- describe blocks group many tests */
import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "../../support/e2e";

const width = (page: Page): number => page.viewportSize()?.width ?? 0;

async function openAudit(page: Page): Promise<void> {
  await signInAs(page, "admin");
  await page.goto("/admin/audit");
  await expect(page.getByRole("heading", { name: "Audit log" })).toBeVisible();
  await expect(page.getByTestId("audit-row").first()).toBeVisible();
}

// Phase-1 demo spec: it signs in through browser storage, which no longer exists. Rebuilt on the server by T-09b.
test.fixme(true, "rebuilt by T-09b");

test.describe("T-09 audit log", () => {
  test("US-19 (S-14) lists seeded entries newest first with IST time, actor, entity and old → new", async ({
    page,
  }) => {
    await openAudit(page);
    const first = page.getByTestId("audit-row").first();
    await expect(first).toContainText("IST");
    await expect(first).toContainText("Old");
    await expect(first).toContainText("New");
    const times = await page
      .getByTestId("audit-row")
      .locator("time")
      .evaluateAll((els) => els.map((e) => e.getAttribute("datetime") ?? ""));
    expect(times.length).toBeGreaterThan(1);
    expect([...times].sort((a, b) => b.localeCompare(a))).toEqual(times);
    await page.screenshot({ path: `.results/T-09/audit-${String(width(page))}.png` });
  });

  test("US-19 filter by action narrows the list", async ({ page }) => {
    await openAudit(page);
    const before = await page.getByTestId("audit-row").count();
    await page.getByRole("combobox", { name: "Action" }).click();
    await page.getByRole("option", { name: "Alert status changed" }).click();
    await expect(page.getByTestId("audit-row").first()).toContainText("Alert status changed");
    const after = await page.getByTestId("audit-row").count();
    expect(after).toBeGreaterThan(0);
    expect(after).toBeLessThan(before);
    await expect(page.getByText("Link created")).toHaveCount(0);
  });

  test("US-19 filter with no matches shows the empty state", async ({ page }) => {
    await openAudit(page);
    await page.getByRole("combobox", { name: "Action" }).click();
    await page.getByRole("option", { name: "Response deleted" }).click();
    await expect(page.getByText("No audit entries")).toBeVisible();
  });

  test("US-19 long old/new values are truncated with Show more", async ({ page }) => {
    await openAudit(page);
    await page.evaluate(() => {
      const key = "psf:v1:audit";
      const rows = JSON.parse(window.localStorage.getItem(key) ?? "[]") as Record<
        string,
        unknown
      >[];
      const first = rows[0];
      if (first) first["newValue"] = { text: "long ".repeat(60) };
      window.localStorage.setItem(key, JSON.stringify(rows));
    });
    await page.reload();
    const row = page.getByTestId("audit-row").filter({ hasText: "long long" });
    const value = row.getByTestId("audit-value").last();
    await expect(value).toContainText("…");
    await row.getByRole("button", { name: "Show more" }).click();
    await expect(value).not.toContainText("…");
    await expect(row.getByRole("button", { name: "Show less" })).toBeVisible();
    await page.screenshot({ path: `.results/T-09/show-more-${String(width(page))}.png` });
  });

  test("US-19 has no edit or delete controls", async ({ page }) => {
    await openAudit(page);
    await expect(page.getByRole("button", { name: /edit|delete|remove|restore/i })).toHaveCount(0);
    await expect(page.getByRole("textbox")).toHaveCount(0);
  });

  test("G-W2 (D-15) a support session is redirected to /not-allowed with no data", async ({
    page,
  }) => {
    await signInAs(page, "support1");
    await page.goto("/admin/audit");
    await expect(page).toHaveURL(/\/not-allowed$/);
    await expect(page.getByText("You don't have access to this page")).toBeVisible();
    await expect(page.getByTestId("audit-row")).toHaveCount(0);
  });
});
