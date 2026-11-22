/* eslint-disable max-lines-per-function -- describe blocks group many tests */
import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "../../support/e2e";

const width = (page: Page): number => page.viewportSize()?.width ?? 0;

async function openAlerts(page: Page, q = ""): Promise<void> {
  await signInAs(page, "admin");
  await page.goto(`/admin/alerts${q}`);
  await expect(page.getByRole("heading", { name: "Alerts" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Kavitha P/ })).toBeVisible();
}

async function markDeleted(page: Page, responseId: string): Promise<void> {
  await page.evaluate((id) => {
    const key = "psf:v1:responses";
    const rows = JSON.parse(window.localStorage.getItem(key) ?? "[]") as { id: string }[];
    const next = rows.map((r) => (r.id === id ? { ...r, deletedAt: new Date().toISOString() } : r));
    window.localStorage.setItem(key, JSON.stringify(next));
  }, responseId);
}

async function stored(page: Page, key: string): Promise<string> {
  return page.evaluate((k) => window.localStorage.getItem(`psf:v1:${k}`) ?? "", key);
}

async function openAlertToContacted(page: Page): Promise<void> {
  await page.getByRole("button", { name: /Kavitha P/ }).click();
  await page.getByRole("button", { name: "Contacted", exact: true }).last().click();
  await page.getByLabel("Add a note").fill("Called, bike rechecked 22 Nov");
  await page.getByRole("button", { name: "Save", exact: true }).click();
}

test.describe("T-07 admin alerts queue", () => {
  test("AC-8 lists alerts newest first, filters by status, tints rows", async ({ page }) => {
    await openAlerts(page);
    const rows = page.locator("li > button[data-status]");
    const ids = await rows.evaluateAll((els) => els.map((e) => e.getAttribute("data-alert-id")));
    const all = JSON.parse(await stored(page, "alerts")) as { id: string; createdAt: string }[];
    const newestFirst = all.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((a) => a.id);
    expect(ids).toEqual(newestFirst);
    await page.getByRole("button", { name: "Open", exact: true }).first().click();
    const shown = await rows.evaluateAll((els) => els.map((e) => e.getAttribute("data-status")));
    expect(shown.length).toBeGreaterThan(0);
    expect(new Set(shown)).toEqual(new Set(["open"]));
    await page.screenshot({ path: `.results/T-07/list-${String(width(page))}.png` });
  });

  // The AC names 'Priya S.'; the seed has no alert for her, so Kavitha P (a seeded open alert) stands in.
  test("AC-8 Kavitha P → Contacted with a note turns amber, updates badge and audit", async ({
    page,
  }) => {
    await openAlerts(page);
    const desktop = width(page) >= 768;
    const badge = page.getByLabel(/\d+ open/).first();
    const before = desktop ? Number((await badge.innerText()).trim()) : 0;
    const wasOpen = await page
      .getByRole("button", { name: /Kavitha P/ })
      .getAttribute("data-status");
    expect(wasOpen).toBe("open");
    await openAlertToContacted(page);
    await expect(page.getByText("Called, bike rechecked 22 Nov").first()).toBeVisible();
    await page.screenshot({ path: `.results/T-07/drawer-${String(width(page))}.png` });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: /Kavitha P/ })).toHaveAttribute(
      "data-status",
      "contacted",
    );
    if (desktop) await expect(page.getByLabel(/\d+ open/).first()).toHaveText(String(before - 1));
    else {
      // phone: the Alerts tab shows a dot while any alert is still open
      const left = (JSON.parse(await stored(page, "alerts")) as { status: string }[]).filter(
        (a) => a.status === "open",
      ).length;
      const dot = page
        .getByRole("navigation", { name: "Admin tabs" })
        .locator('a[href="/admin/alerts"] .bg-brand');
      await expect(dot).toHaveCount(left > 0 ? 1 : 0);
    }
    const audit = await stored(page, "audit");
    expect(audit).toContain("alert.status");
    expect(audit).toContain("alert.note");
    expect(audit).toContain('"oldValue":"open"');
    expect(audit).toContain('"newValue":"contacted"');
  });

  test("AC-8 a resolved alert can be reopened to Open", async ({ page }) => {
    await openAlerts(page);
    await page.getByRole("button", { name: /Kavitha P/ }).click();
    await page.getByRole("button", { name: "Resolved", exact: true }).last().click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "Open", exact: true }).last().click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: /Kavitha P/ })).toHaveAttribute(
      "data-status",
      "open",
    );
  });

  test("AC-8 the drawer shows customer, phone, vehicle, reasons and the response link", async ({
    page,
  }) => {
    await openAlerts(page);
    await page.getByRole("button", { name: /Kavitha P/ }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer.getByText("Kavitha P")).toBeVisible();
    await expect(drawer.getByText("Phone")).toBeVisible();
    await expect(drawer.getByText("Vehicle")).toBeVisible();
    const link = drawer.getByRole("link", { name: "View response" });
    await expect(link).toHaveAttribute("href", /^\/admin\/responses\/r-/);
  });

  test("AC-8 alerts of deleted responses are hidden", async ({ page }) => {
    await openAlerts(page);
    const before = await page.locator("li > button[data-status]").count();
    await markDeleted(page, "r-s005");
    await page.reload();
    await expect(page.locator("li > button[data-status]")).toHaveCount(before - 1);
  });

  test("AC-8 with no alerts it says all customers are happy", async ({ page }) => {
    await openAlerts(page);
    await page.evaluate(() => {
      window.localStorage.setItem("psf:v1:alerts", "[]");
    });
    await page.reload();
    await expect(page.getByText("No alerts — all customers happy")).toBeVisible();
    await page.screenshot({ path: `.results/T-07/empty-${String(width(page))}.png` });
  });

  test("s13 a failed save keeps the note and shows Couldn't save, try again (S-13)", async ({
    page,
  }) => {
    await openAlerts(page, "?demoFail=1");
    await openAlertToContacted(page);
    await expect(page.getByText("Couldn't save, try again")).toBeVisible();
    await expect(page.getByLabel("Add a note")).toHaveValue("Called, bike rechecked 22 Nov");
    await page.screenshot({ path: `.results/T-07/save-failed-${String(width(page))}.png` });
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByLabel("Add a note")).toHaveValue("");
    expect(await stored(page, "audit")).toContain("alert.note");
  });
});
