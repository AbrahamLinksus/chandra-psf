/* eslint-disable max-lines-per-function -- describe blocks group several specs */
import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "../../support/e2e";

const BLOCKS = [
  "Category scores",
  "Trend",
  "Advisor performance",
  "Problem breakdown",
  "Question-level detail",
  "Recent comments",
];
const isDesktop = (page: Page): boolean => (page.viewportSize()?.width ?? 0) >= 1024;
const shot = (page: Page, name: string): Promise<Buffer> =>
  page.screenshot({
    path: `.results/T-06/${name}-${String(page.viewportSize()?.width)}.png`,
    fullPage: true,
  });

async function openOverview(page: Page, query = ""): Promise<void> {
  await signInAs(page, "admin");
  await page.goto(`/admin${query}`);
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
}

async function pick(page: Page, label: string, option: string): Promise<void> {
  await page.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

const responses = (page: Page) =>
  page.getByTestId("kpi-tile").filter({ hasText: "Responses received" });

test.describe("T-06 admin overview", () => {
  test("AC-10 (S-07) / default last 30 days: 5 KPI tiles with arrows and all 7 blocks filled", async ({
    page,
  }) => {
    await openOverview(page);
    await expect(page.getByTestId("kpi-tile")).toHaveCount(5);
    await expect(page.getByTestId("delta").first()).toBeVisible();
    await expect(page.locator('[data-direction="up"]').first()).toHaveClass(/text-success/);
    await expect(page.locator('[data-direction="down"]').first()).toHaveClass(/text-danger/);
    for (const b of BLOCKS) await expect(page.getByRole("heading", { name: b })).toBeVisible();
    await expect(page.getByTestId("advisor-row").first()).toBeVisible();
    await expect(page.getByTestId("comment").first()).toBeVisible();
    await shot(page, "overview");
  });

  test("AC-10 / advisor table sorts by a clicked column", async ({ page }) => {
    await openOverview(page);
    const names = () => page.getByTestId("advisor-row").locator("td:first-child").allInnerTexts();
    const head = page.getByRole("button", { name: "Advisor", exact: true });
    await head.click();
    const desc = await names();
    expect(desc).toEqual([...desc].sort((a, b) => b.localeCompare(a)));
    await head.click();
    expect(await names()).toEqual([...desc].reverse());
  });

  test("AC-10 / problem breakdown has a follow-up selector", async ({ page }) => {
    await openOverview(page);
    const block = page.locator("section").filter({ hasText: "Problem breakdown" });
    await expect(block).toContainText("What was wrong with the work?");
    await pick(page, "Follow-up question", "Q7a");
    await expect(block).not.toContainText("What was wrong with the work?");
    await expect(block).toContainText("Q7a");
  });

  test("S-11 / every filter changes the blocks and is kept in the URL", async ({ page }) => {
    await openOverview(page);
    await expect(responses(page)).toContainText("11");
    await pick(page, "Advisor", "Anand");
    await expect(page).toHaveURL(/advisorId=/);
    await expect(page.getByTestId("advisor-row")).toHaveCount(1);
    await expect(responses(page)).toContainText("3");
    await page.reload();
    await expect(page.getByRole("combobox", { name: "Advisor" })).toHaveText("Anand");
    await expect(responses(page)).toContainText("3");

    await openOverview(page);
    await pick(page, "Vehicle type", "scooter");
    await expect(page).toHaveURL(/vehicleType=scooter/);
    await expect(responses(page)).not.toContainText("11");

    await openOverview(page);
    await pick(page, "Model", "Activa 6G");
    await expect(page).toHaveURL(/model=Activa/);
    await expect(responses(page)).not.toContainText("11");

    await openOverview(page);
    await page.getByLabel("From").fill("2026-11-15");
    await expect(page).toHaveURL(/from=2026-11-15/);
    await expect(responses(page)).not.toContainText("11");
  });

  test("S-10 / a filter matching nothing shows dashes, no arrows, never 0 %, NaN or infinity", async ({
    page,
  }) => {
    await openOverview(page, "?from=2020-01-01&to=2020-01-31");
    await expect(page.getByText("No responses for these filters")).toBeVisible();
    await expect(responses(page)).toContainText("—");
    await expect(page.getByTestId("delta")).toHaveCount(0);
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(/NaN|∞|Infinity|\b0%/);
    await shot(page, "overview-empty");
  });

  test("G-W3 / a <script> comment is shown as plain text", async ({ page }) => {
    await signInAs(page, "admin");
    await page.goto("/sign-in");
    await page.evaluate(() => {
      const key = "psf:v1:responses";
      const rows = JSON.parse(window.localStorage.getItem(key) ?? "[]") as {
        id: string;
        answers: Record<string, unknown>;
      }[];
      const hit = rows.find((r) => r.id === "r-s001");
      if (hit) hit.answers["Q14"] = "<script>window.__xss=1</script>";
      window.localStorage.setItem(key, JSON.stringify(rows));
    });
    await page.goto("/admin");
    await expect(page.getByTestId("comment").filter({ hasText: "<script>" })).toBeVisible();
    expect(await page.evaluate(() => "__xss" in window)).toBe(false);
    await expect(page.locator("main script")).toHaveCount(0);
  });

  test("G-W2 (AC-6) / a support session cannot see the overview", async ({ page }) => {
    await signInAs(page, "support1");
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/not-allowed$/);
    await expect(page.getByText("You don't have access to this page")).toBeVisible();
    await expect(page.getByTestId("kpi-tile")).toHaveCount(0);
  });

  test("AC-10 / single column at 360 px, grid at 1440 px", async ({ page }) => {
    await openOverview(page);
    await expect(page.getByTestId("kpi-tile")).toHaveCount(5);
    const tops = await page
      .getByTestId("kpi-tile")
      .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    if (isDesktop(page)) {
      expect(new Set(tops).size).toBe(1);
    } else {
      expect(new Set(tops).size).toBe(5);
      const width = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(width).toBeLessThanOrEqual(360);
    }
  });
});
