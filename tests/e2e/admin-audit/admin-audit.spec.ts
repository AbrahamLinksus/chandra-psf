/* eslint-disable max-lines-per-function -- each test plays one scenario end to end */
import { expect, test } from "@playwright/test";
import { createBranch, createSupportUser } from "../../support/e2e";
import { sharedAdminInBrowser } from "../admin-users/sharedAdmin";
import { newBranch } from "../support-links/helpers";

const SHOT = ".results/T-09b";
const uniq = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

test.describe("T-09b audit log on the server", () => {
  test("US-19 (S-14) the main admin sees Branch on each row, filters by branch, and has no edit controls", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const base = String(baseURL);
    const admin = await sharedAdminInBrowser(page, playwright, base);
    const { id: branchId } = await createBranch(admin, {
      name: `Audit ${uniq()}`,
      city: "Chennai",
    });
    await createSupportUser(admin, {
      name: "Arun",
      email: `arun${uniq()}@ch.in`,
      tempPassword: "Temp-Pass-4471",
      branchId,
    });
    await page.goto("/admin/audit");
    await expect(page.getByRole("heading", { name: "Audit log" })).toBeVisible();
    await expect(page.getByTestId("audit-row").first()).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Branch" })).toBeVisible();
    await expect(page.getByTestId("audit-row").first()).toContainText("IST");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, "the page must not scroll sideways").toBeLessThanOrEqual(0);
    await page.screenshot({ path: `${SHOT}/audit-${String(page.viewportSize()?.width)}.png` });

    await page.getByRole("combobox", { name: "Branch" }).click();
    const options = page.getByRole("option");
    const label = (await options.allTextContents()).find((t) => t.startsWith("Audit "));
    expect(label).toBeDefined();
    await options.filter({ hasText: String(label) }).click();
    const rows = page.getByTestId("audit-row");
    await expect(rows.first()).toBeVisible();
    for (const text of await rows.allTextContents()) expect(text).toContain(String(label));

    await expect(page.getByRole("button", { name: /edit|delete|remove|restore/i })).toHaveCount(0);
    await page.screenshot({
      path: `${SHOT}/audit-branch-${String(page.viewportSize()?.width)}.png`,
    });
  });

  test("G-W2 a support user gets FORBIDDEN from the audit RPC and is turned away from the page", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const base = String(baseURL);
    const { staff } = await newBranch(playwright, base, {
      label: `AuditF ${uniq()}`,
      name: "Ravi",
    });
    const res = await staff.api.request.post("/api/rpc/audit/listAudit", {
      headers: { origin: staff.api.origin },
      data: { args: [] },
    });
    expect(await res.json()).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    await page.context().addCookies(staff.cookies);
    await page.goto("/admin/audit");
    await expect(page.getByTestId("audit-row")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Audit log" })).toHaveCount(0);
  });
});
