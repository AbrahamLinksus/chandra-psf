/* eslint-disable max-lines-per-function -- each test plays one scenario end to end */
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { createSupportUser, rpcCall } from "../../support/e2e";
import { sharedAdminApi, sharedAdminInBrowser } from "../admin-users/sharedAdmin";
import { newBranch } from "../support-links/helpers";
import {
  FRESH_TEMP,
  HAPPY,
  OWN,
  TEMP,
  afterFirstRunStarted,
  cardWithLink,
  daysAgo,
  digits,
  ownMainAdmin,
  regOf,
  setPasswordUI,
  shot,
  signInUI,
  uniq,
  today,
} from "./helpers";

test.beforeAll(afterFirstRunStarted);

const RANGE = { from: "2000-01-01", to: "2100-01-01" };
const Q1 = "Were you satisfied with the overall service experience?";
const row = (page: Page, email: string) => page.locator(`li[data-user-email="${email}"]`);

interface Entry {
  action: string;
  entityId: string;
  oldValue: unknown;
  newValue: unknown;
}

async function confirmPassword(page: Page, password: string): Promise<void> {
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
}

async function responsesCount(admin: Parameters<typeof rpcCall>[0], branchId: string) {
  const a = await rpcCall<{ kpis: { responses: { value: number | null } } }>(
    admin,
    "analytics",
    "getAnalytics",
    [{ ...RANGE, branchId }],
  );
  return a.kpis.responses.value;
}

test.describe("T-11b DoD 11-14: edit, lock-out, erase, clean-up", () => {
  test("test_s09_edit_delete_restore_with_the_password_and_the_audit_keeps_old_and_new (S-09, DoD 11)", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const base = String(baseURL);
    // A main admin of its own: wrong-password and erase steps never touch the shared admin's session.
    const { api: admin, cookies } = await ownMainAdmin(playwright, base);
    await page.context().addCookies(cookies);
    const { branchId, staff } = await newBranch(playwright, base, {
      label: "Edits",
      name: "Priya",
    });
    await cardWithLink(
      staff,
      { name: "Meena Test", phone: digits(), reg: regOf(), date: today() },
      HAPPY,
    );
    const rows = await rpcCall<{ id: string }[]>(admin, "responses", "listResponses", [
      { ...RANGE, branchId },
    ]);
    const id = rows[0]?.id ?? "";
    expect(await responsesCount(admin, branchId)).toBe(1);

    // Edit Q1 4 -> 3: a wrong password changes nothing, the right one saves.
    await page.goto(`/admin/responses/${id}`);
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page
      .getByRole("group", { name: Q1 })
      .getByRole("button", { name: "3", exact: true })
      .click();
    await page.getByRole("button", { name: "Save changes" }).click();
    await confirmPassword(page, "wrong-password-1");
    await expect(page.getByText("Password incorrect")).toBeVisible();
    await shot(page, "controls-1-wrong-password");
    await confirmPassword(page, OWN);
    await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
    const after = await rpcCall<{ response: { answers: Record<string, unknown> } }>(
      admin,
      "responses",
      "getResponse",
      [id],
    );
    expect(after.response.answers["Q1"]).toBe(3);

    // Delete with the password: Responses received drops 1 -> 0 (S-09).
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    await confirmPassword(page, OWN);
    await expect(page).toHaveURL(/\/admin\/responses$/);
    expect((await responsesCount(admin, branchId)) ?? 0).toBe(0);

    // Restore from Recently deleted: it counts again, answers as they were after the edit.
    await page.goto("/admin/responses/deleted");
    const gone = page.locator(`li[data-response-id="${id}"]`);
    await expect(gone).toContainText("Meena Test");
    await gone.getByRole("button", { name: "Restore" }).click();
    await confirmPassword(page, OWN);
    await expect(page.locator(`li[data-response-id="${id}"]`)).toHaveCount(0);
    expect(await responsesCount(admin, branchId)).toBe(1);
    const back = await rpcCall<{ response: { answers: Record<string, unknown> } }>(
      admin,
      "responses",
      "getResponse",
      [id],
    );
    expect(back.response.answers["Q1"]).toBe(3);

    // The audit holds all three, the edit with old and new values.
    const audit = await rpcCall<{ entries: Entry[] }>(admin, "audit", "listAudit", [{ branchId }]);
    const mine = audit.entries.filter((e) => e.entityId === id).map((e) => e.action);
    expect(mine).toEqual(
      expect.arrayContaining(["response.edit", "response.delete", "response.restore"]),
    );
    const edit = audit.entries.find((e) => e.entityId === id && e.action === "response.edit");
    expect(JSON.stringify(edit?.oldValue)).toContain("4");
    expect(JSON.stringify(edit?.newValue)).toContain("3");
    expect(JSON.stringify(edit?.oldValue)).not.toEqual(JSON.stringify(edit?.newValue));
    await page.goto("/admin/audit");
    await expect(
      page.getByTestId("audit-row").filter({ hasText: "Response restored" }).first(),
    ).toBeVisible();
    await shot(page, "controls-2-audit-edit-delete-restore");
  });

  test("test_s27_five_wrong_passwords_lock_the_email_and_an_admin_reset_clears_it (S-27, DoD 12)", async ({
    page,
    browser,
    playwright,
    baseURL,
  }) => {
    const base = String(baseURL);
    const admin = await sharedAdminApi(playwright, base);
    const { branchId } = await newBranch(playwright, base, { label: "Lock", name: "Priya" });
    const email = `lock${uniq()}@ch.in`;
    await createSupportUser(admin, { name: "Priya", email, tempPassword: TEMP, branchId });

    // The user (own browser) tries wrong passwords 5 times; the next try is refused even when right.
    const context = await browser.newContext({ baseURL: base, viewport: page.viewportSize() });
    const user = await context.newPage();
    await user.goto("/sign-in");
    for (let i = 0; i < 5; i++) {
      await signInUI(user, email, `wrong-password-${String(i)}`);
      await expect(user.locator("main [role=alert]")).toHaveText("Email or password is incorrect");
    }
    await signInUI(user, email, TEMP);
    await expect(user.locator("main [role=alert]")).toHaveText(
      "Too many attempts. Try again in 15 minutes.",
    );
    await expect(user).toHaveURL(/\/sign-in$/);
    await shot(user, "controls-3-locked-out");

    // The admin resets the password: the lock is cleared and the new temporary one works.
    await sharedAdminInBrowser(page, playwright, base);
    await page.goto("/admin/users");
    await row(page, email).getByRole("button", { name: "Reset password" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Temporary password").fill(FRESH_TEMP);
    await dialog.getByRole("button", { name: "Reset password", exact: true }).click();
    await expect(page.getByTestId("reset-confirmation")).toContainText(FRESH_TEMP);
    await page.getByRole("button", { name: "Done" }).click();

    await signInUI(user, email, FRESH_TEMP);
    await expect(user).toHaveURL(/\/set-password$/);
    await setPasswordUI(user, OWN);
    await expect(user).toHaveURL(/\/support$/);
    await context.close();

    const locks = await rpcCall<{ entries: Entry[] }>(admin, "audit", "listAudit", [
      { action: "auth.lockout" },
    ]);
    expect(locks.entries.length).toBeGreaterThanOrEqual(1);
  });

  test("test_s21_erase_one_ticked_customer_leaves_the_other_branch_untouched (S-21, DoD 14)", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const base = String(baseURL);
    // A main admin of its own: wrong-password and erase steps never touch the shared admin's session.
    const { api: admin, cookies } = await ownMainAdmin(playwright, base);
    await page.context().addCookies(cookies);
    const vel = await newBranch(playwright, base, { label: "Velachery", name: "Kavitha" });
    const tam = await newBranch(playwright, base, { label: "Tambaram", name: "Mohan" });
    const phone = digits();
    const spaced = `${phone.slice(0, 5)} ${phone.slice(5)}`;
    const ramesh = await cardWithLink(
      vel.staff,
      { name: "Ramesh Kumar", phone: spaced, reg: regOf(), date: daysAgo(30) },
      { ...HAPPY, Q2: "No", Q2a: "Advisor was rude, ring me" },
    );
    const brother = await cardWithLink(
      tam.staff,
      { name: "Suresh Kumar", phone: spaced, reg: regOf(), date: daysAgo(2) },
      HAPPY,
    );

    await page.goto("/admin/customers");
    await page.getByLabel("Phone number or registration number").fill(spaced);
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByRole("checkbox")).toHaveCount(2);
    await expect(page.getByRole("button", { name: "Erase selected" })).toBeDisabled();
    await page
      .getByRole("listitem")
      .filter({ hasText: "Ramesh Kumar" })
      .getByRole("checkbox")
      .check();
    await page.getByRole("button", { name: "Erase selected" }).click();
    const dialog = page.getByTestId("erase-dialog");
    await expect(dialog).toContainText("1 row");
    await shot(page, "controls-4-erase-dialog");
    await dialog.getByLabel("Your password").fill(OWN);
    await dialog.getByRole("button", { name: "Confirm erase" }).click();
    await expect(page.getByTestId("erase-notice")).toHaveText("Erased customer");
    await shot(page, "controls-5-erased");

    const left = await rpcCall<{ jobCardId: string }[]>(admin, "customers", "searchCustomers", [
      { phone },
    ]);
    expect(left.map((r) => r.jobCardId)).toEqual([brother.id]);
    await page.goto(`/f/${ramesh.code}`);
    await expect(page.getByText("Link not valid")).toBeVisible();
    await page.goto(`/f/${brother.code}`);
    await expect(page.getByText("Link not valid")).toHaveCount(0);
    const audit = await rpcCall<{ entries: Entry[] }>(admin, "audit", "listAudit", [
      { action: "customer.erase" },
    ]);
    expect(audit.entries[0]?.newValue).toEqual({ count: 1 });
    expect(JSON.stringify(audit.entries[0])).not.toMatch(/Ramesh|rude/i);
  });

  test("test_s21_daily_clean_up_runs_with_the_secret_audits_itself_and_keeps_data_that_is_not_due (S-21, DoD 14)", async ({
    playwright,
    baseURL,
  }) => {
    const base = String(baseURL);
    const admin = await sharedAdminApi(playwright, base);
    const { staff } = await newBranch(playwright, base, { label: "Cleanup", name: "Ravi" });
    const phone = digits();
    // The app refuses service dates older than 60 days, so nothing can be aged to the 90-day / 3-year
    // line here (cleanup.test.ts covers the cut-offs with an injected clock): the oldest data the
    // walkthrough can make must survive the run.
    const old = await cardWithLink(staff, {
      name: "Old Unanswered",
      phone,
      reg: regOf(),
      date: daysAgo(59),
    });
    const answered = await cardWithLink(
      staff,
      { name: "Fresh Answered", phone, reg: regOf(), date: today() },
      HAPPY,
    );

    const secret =
      process.env["CRON_SECRET"] ??
      /^CRON_SECRET=(.*)$/m.exec(readFileSync(".env.example", "utf8"))?.[1] ??
      "";
    const anon = await playwright.request.newContext({ baseURL: base });
    expect((await anon.get("/api/cron/daily")).status()).toBe(401);
    expect(
      (
        await anon.get("/api/cron/daily", { headers: { authorization: "Bearer wrong-secret" } })
      ).status(),
    ).toBe(401);
    const run = await anon.get("/api/cron/daily", {
      headers: { authorization: `Bearer ${secret}` },
    });
    expect(run.status()).toBe(200);
    expect(await run.json()).toMatchObject({ stoppedEarly: false });

    const left = await rpcCall<{ jobCardId: string }[]>(admin, "customers", "searchCustomers", [
      { phone },
    ]);
    expect(left.map((r) => r.jobCardId).sort()).toEqual([old.id, answered.id].sort());
    for (const kept of [old, answered]) {
      expect(await (await anon.get(`/f/${kept.code}`)).text()).not.toContain("Link not valid");
    }
    await anon.dispose();
    const audit = await rpcCall<{ entries: Entry[] }>(admin, "audit", "listAudit", [
      { action: "system.cleanup" },
    ]);
    expect(audit.entries.length).toBeGreaterThanOrEqual(1);
  });
});
