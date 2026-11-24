import { expect, test, type Page } from "@playwright/test";
import { createBranch, createSupportUser } from "../../support/e2e";
import { sharedAdminInBrowser } from "./sharedAdmin";

/** A slow host: the list read that follows a save takes this long to answer. */
const SLOW_LIST_MS = 6_000;
/** The saved row must show well before the slow list read comes back. */
const WITHOUT_RELOAD_MS = 2_500;
const TEMP = "Temp-Pass-4471";

const row = (page: Page, email: string) => page.locator(`li[data-user-email="${email}"]`);
const tag = (page: Page): string => `${String(page.viewportSize()?.width)}.${String(Date.now())}`;

async function slowUserList(page: Page): Promise<void> {
  await page.route("**/api/rpc/users/listUsers", async (route) => {
    await new Promise((r) => setTimeout(r, SLOW_LIST_MS));
    await route.continue().catch(() => undefined);
  });
}

async function openUsers(
  page: Page,
  playwright: Parameters<typeof sharedAdminInBrowser>[1],
  base: string,
) {
  const api = await sharedAdminInBrowser(page, playwright, base);
  const branchName = `Refresh ${tag(page)}`;
  const { id: branchId } = await createBranch(api, { name: branchName, city: "Chennai" });
  return { api, branchId, branchName };
}

test.describe("T-32 user list refreshes right after Add, Edit and Deactivate (no reload)", () => {
  // The admin session is shared with the other T-32 spec (the sign-in limit is per run).
  test("test_add_edit_deactivate_show_while_the_list_read_is_still_slow (T-32)", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const { api, branchId, branchName } = await openUsers(page, playwright, String(baseURL));
    const seeded = `edit.${tag(page)}@chandrahonda.in`;
    await createSupportUser(api, { name: "Editable", email: seeded, tempPassword: TEMP, branchId });
    await page.goto("/admin/users");
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
    await expect(row(page, seeded)).toBeVisible();
    await slowUserList(page);

    const email = `add.${tag(page)}@chandrahonda.in`;
    await page.getByLabel("Name").fill("Added");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Temporary password").fill(TEMP);
    await page.getByRole("combobox", { name: "Branch" }).click();
    await page.getByRole("option", { name: branchName }).click();
    await page.getByRole("button", { name: "Add user" }).click();
    await expect(row(page, email)).toBeVisible({ timeout: WITHOUT_RELOAD_MS });
    await page.screenshot({
      path: `.results/T-32/e2e-user-added-${String(page.viewportSize()?.width)}.png`,
    });

    await row(page, seeded).getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Name").last().fill("Renamed");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(row(page, seeded)).toContainText("Renamed", { timeout: WITHOUT_RELOAD_MS });

    await row(page, seeded).getByRole("button", { name: "Deactivate" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Deactivate" }).click();
    await expect(row(page, seeded)).toContainText("Inactive", { timeout: WITHOUT_RELOAD_MS });
  });
});
