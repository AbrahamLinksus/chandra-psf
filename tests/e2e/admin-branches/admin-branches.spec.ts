/* eslint-disable max-lines-per-function -- describe blocks group several specs */
import { expect, test, type Page } from "@playwright/test";
import { adminApi, adminSessionInBrowser, createBranch, listBranches } from "../../support/e2e";

const width = (page: Page): string => String(page.viewportSize()?.width);
const branchRow = (page: Page, name: string) => page.locator(`li[data-branch-name="${name}"]`);

async function addBranch(page: Page, name: string, city: string): Promise<void> {
  await page.getByLabel("Branch name").fill(name);
  await page.getByLabel("City", { exact: true }).fill(city);
  await page.getByRole("button", { name: "Add branch" }).click();
}

test.describe("T-21 branches and advisors (main admin)", () => {
  test("test_first_run_card_leads_to_branches_then_add_duplicate_rename_deactivate_reactivate (US-23, US-24)", async ({
    page,
    playwright,
    baseURL,
  }) => {
    // Both browser projects share one database, so use names unique to this project.
    const w = width(page);
    const velachery = `Velachery ${w}`;
    const chennai = `Chennai ${w}`;
    const api = await adminApi(playwright, String(baseURL));
    await adminSessionInBrowser(page, playwright, String(baseURL));

    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    const card = page.getByRole("link", { name: "Add your first branch" });
    // Specs share one database and run in parallel, so decide from the page, not from an earlier API call.
    const firstRunShown = await card
      .waitFor({ state: "visible", timeout: 5_000 })
      .then(() => true)
      .catch(() => false);
    if (firstRunShown) {
      await page.screenshot({ path: `.results/T-21/e2e-first-run-${w}.png` });
      await card.click();
      await expect(page).toHaveURL(/\/admin\/branches$/);
    } else {
      // The card only shows while there are no branches, so another spec must have created one.
      expect((await listBranches(api)).length).toBeGreaterThan(0);
      await page.goto("/admin/branches");
    }
    await expect(page.getByRole("heading", { name: "Branches" })).toBeVisible();

    await addBranch(page, velachery, "Chennai");
    await expect(branchRow(page, velachery)).toContainText("Active");
    await addBranch(page, chennai, "Chennai");
    await expect(branchRow(page, chennai)).toBeVisible();

    await addBranch(page, velachery, "Chennai");
    await expect(page.getByText("A branch with this name already exists")).toBeVisible();
    await page.screenshot({ path: `.results/T-21/e2e-duplicate-${w}.png` });

    await branchRow(page, chennai).getByRole("button", { name: "Rename" }).click();
    await page.getByLabel("Branch name").last().fill(`${chennai} Central`);
    await page.getByRole("button", { name: "Save" }).click();
    const renamed = branchRow(page, `${chennai} Central`);
    await expect(renamed).toBeVisible();

    await renamed.getByRole("button", { name: "Deactivate" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Deactivate" }).click();
    await expect(renamed).toContainText("Inactive");
    await renamed.getByRole("button", { name: "Reactivate" }).click();
    await expect(renamed).toContainText("Active");
    // never deleted: still listed after a reload
    await page.reload();
    await expect(branchRow(page, `${chennai} Central`)).toBeVisible();
  });

  test("test_us25_main_admin_adds_advisor_suresh_renames_and_toggles_him", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const api = await adminApi(playwright, String(baseURL));
    const { id } = await createBranch(api, {
      name: `Advisor Branch ${width(page)}`,
      city: "Chennai",
    });
    await adminSessionInBrowser(page, playwright, String(baseURL));

    await page.goto(`/admin/branches/${id}`);
    await expect(page.getByRole("heading", { name: "Advisors" })).toBeVisible();
    await page.getByLabel("Advisor name").fill("Suresh");
    await page.getByRole("button", { name: "Add advisor" }).click();
    const suresh = page.locator("li").filter({ hasText: "Suresh" });
    await expect(suresh).toBeVisible();

    await page.getByLabel("Advisor name").first().fill("Suresh");
    await page.getByRole("button", { name: "Add advisor" }).click();
    await expect(page.getByText("An advisor with this name already exists")).toBeVisible();

    await suresh.getByRole("button", { name: "Rename" }).click();
    await page.getByLabel("Advisor name").last().fill("Suresh Kumar");
    await page.getByRole("button", { name: "Save" }).click();
    const renamed = page.locator("li").filter({ hasText: "Suresh Kumar" });
    await expect(renamed).toBeVisible();

    await renamed.getByRole("button", { name: "Deactivate" }).click();
    await expect(renamed.getByRole("button", { name: "Reactivate" })).toBeVisible();
    await renamed.getByRole("button", { name: "Reactivate" }).click();
    await expect(renamed.getByRole("button", { name: "Deactivate" })).toBeVisible();
    await page.screenshot({ path: `.results/T-21/e2e-advisors-${width(page)}.png` });
  });

  test("role guard: a main admin is turned away from /admin/advisors (branch admins only)", async ({
    page,
    playwright,
    baseURL,
  }) => {
    await adminSessionInBrowser(page, playwright, String(baseURL));
    await page.goto("/admin/advisors");
    await expect(page).toHaveURL(/\/not-allowed$/);
  });

  test("a signed-out visitor opening /admin/branches is sent to sign-in", async ({ page }) => {
    await page.goto("/admin/branches");
    await expect(page).toHaveURL(/\/sign-in/);
  });
});
