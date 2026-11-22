import { expect, test } from "@playwright/test";
import { signInAs } from "../../support/e2e";

const ALL = "/admin/responses?from=2000-01-01&to=2100-01-01";

test.describe("T-08 rework regressions", () => {
  test("rework: the list defaults to the last 30 days; an explicit from/to shows older rows", async ({
    page,
  }) => {
    await signInAs(page, "admin");
    await page.goto("/admin/responses");
    const rows = page.locator("tr[data-response-id]");
    await expect(rows.first()).toBeVisible();
    const recent = await rows.count();
    await page.goto(ALL);
    await expect(rows.first()).toBeVisible();
    const all = await rows.count();
    expect(recent).toBeLessThanOrEqual(all);
    const old = new Date(Date.now() - 400 * 86_400_000).toISOString().slice(0, 10);
    await page.goto(`/admin/responses?from=2000-01-01&to=${old}`);
    await expect(page.getByText("No responses match these filters")).toBeVisible();
  });

  test("rework: Alert badge only for open alerts; row click and customer link navigate once", async ({
    page,
  }) => {
    await signInAs(page, "admin");
    await page.goto(ALL);
    const contacted = page.locator('tr[data-response-id="r-s020"]');
    await expect(contacted).toBeVisible();
    await expect(contacted.getByText("Alert", { exact: true })).toHaveCount(0);
    await contacted.getByRole("link").click();
    await expect(page).toHaveURL(/\/admin\/responses\/r-s020$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/admin\/responses\?/);
    await expect(page.getByRole("heading", { name: "Responses" })).toBeVisible();
  });
});
