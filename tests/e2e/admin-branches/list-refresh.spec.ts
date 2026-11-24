import { expect, test } from "@playwright/test";
import { sharedAdminInBrowser } from "../admin-users/sharedAdmin";

/** A slow host: the list read that follows a save takes this long to answer. */
const SLOW_LIST_MS = 6_000;
/** The saved row must show well before the slow list read comes back. */
const WITHOUT_RELOAD_MS = 2_500;

test.describe("T-32 branch list refreshes right after Add branch (no reload)", () => {
  test("test_new_branch_row_shows_while_the_list_read_is_still_slow (T-32)", async ({
    page,
    playwright,
    baseURL,
  }) => {
    await sharedAdminInBrowser(page, playwright, String(baseURL));
    await page.goto("/admin/branches");
    await expect(page.getByRole("heading", { name: "Branches" })).toBeVisible();
    await page.route("**/api/rpc/branches/listBranches", async (route) => {
      await new Promise((r) => setTimeout(r, SLOW_LIST_MS));
      await route.continue().catch(() => undefined);
    });

    const name = `Refresh ${String(page.viewportSize()?.width)} ${String(Date.now())}`;
    await page.getByLabel("Branch name").fill(name);
    await page.getByLabel("City", { exact: true }).fill("Chennai");
    await page.getByRole("button", { name: "Add branch" }).click();
    await expect(page.locator(`li[data-branch-name="${name}"]`)).toContainText("Active", {
      timeout: WITHOUT_RELOAD_MS,
    });
    await page.screenshot({
      path: `.results/T-32/e2e-branch-added-${String(page.viewportSize()?.width)}.png`,
    });
  });
});
