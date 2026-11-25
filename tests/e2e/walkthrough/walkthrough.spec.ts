/* eslint-disable max-lines-per-function -- one test plays the whole two-device scenario */
import { expect, test, type Page } from "@playwright/test";
import { rpcCall } from "../../support/e2e";
import { sharedAdminApi } from "../admin-users/sharedAdmin";
import { actAs, newBranch } from "../support-links/helpers";
import {
  CALLBACK,
  afterFirstRunStarted,
  answerCallback,
  branchAdminFor,
  cardWithLink,
  fillUntilCallback,
  shot,
  submitForm,
  today,
} from "./helpers";

test.beforeAll(afterFirstRunStarted);

const POLL_WAIT = 50_000; // the support list refreshes every 30 s while in use (G-6)
const NOTE = "Called Selvam, bike rechecked";

interface AlertRow {
  id: string;
  customerName: string;
  status: string;
}

async function typeInJobCard(page: Page, no: string): Promise<void> {
  await page.goto("/support/new");
  await expect(page.getByRole("heading", { name: "New feedback link" })).toBeVisible();
  await page.getByLabel("Job card number").first().fill(no);
  await page.getByRole("button", { name: "Look up" }).click();
  const missing = page.getByRole("alert").filter({ hasText: "at this branch yet" });
  await missing.getByRole("button", { name: "New job card" }).click();
  const form = page.locator("form").filter({ hasText: "Save job card" });
  await form.getByLabel("Customer name").fill("Ramesh Kumar");
  await form.getByLabel("Mobile (optional)").fill("98400 12345");
  await form.getByLabel("Reg. no.").fill("tn09bx4521");
  await form.getByLabel("Model", { exact: true }).selectOption("Activa");
  await form.getByLabel("Service type").selectOption("Paid service");
  await form.getByLabel("Advisor").selectOption({ label: "Suresh" });
  await page.getByRole("button", { name: "Save job card" }).click();
  await expect(page.getByRole("region", { name: "Job card details" })).toContainText(
    "Ramesh Kumar",
  );
}

async function setStatus(page: Page, who: string, status: string, note?: string): Promise<void> {
  await page.getByRole("button", { name: new RegExp(who) }).click();
  await page.getByRole("button", { name: status, exact: true }).last().click();
  if (note) await page.getByLabel("Add a note").fill(note);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByLabel("Add a note")).toHaveValue("");
  await page.keyboard.press("Escape");
}

test.describe("T-11b DoD 3-8: two devices, one visit", () => {
  test("test_s12_phone_completes_form_laptop_sees_opened_then_completed_alert_contacted_resolved_all_audited (S-12, S-06, DoD 3-8)", async ({
    page,
    browser,
    playwright,
    baseURL,
  }) => {
    test.setTimeout(240_000);
    const base = String(baseURL);
    const { branchId, staff } = await newBranch(playwright, base, {
      label: "Velachery",
      name: "Kavitha",
    });
    const boss = await branchAdminFor(playwright, base, branchId);
    // An older alert, already in the queue, that tab A will work on while tab B submits (S-06).
    await cardWithLink(
      staff,
      { name: "Farida Banu", phone: "98400 55555", reg: "tn10ab1111", date: today() },
      CALLBACK,
    );

    // --- Support laptop: type in a new job card, generate the link, WhatsApp message ---
    await actAs(page, staff);
    const no = `JC-24-${String(1000 + Math.floor(Math.random() * 8999))}`;
    await typeInJobCard(page, no);
    await page.getByRole("button", { name: "Generate link" }).click();
    const url = (await page.getByTestId("link-url").textContent()) ?? "";
    expect(url).toMatch(/\/f\/[A-Za-z0-9_-]{43}$/);
    expect(url).not.toMatch(/Ramesh|98400|JC-24|tn09/i); // the link holds no customer data (AC-2)
    const href =
      (await page.getByRole("link", { name: "Send on WhatsApp" }).getAttribute("href")) ?? "";
    expect(href).toContain("https://wa.me/919840012345?text=");
    expect(decodeURIComponent(href)).toContain(url);
    await shot(page, "journey-1-link-generated");
    const path = new URL(url).pathname;

    // Tab A: the branch admin's alert queue, opened now and not reloaded until later (S-06).
    const adminContext = await browser.newContext({ baseURL: base, viewport: page.viewportSize() });
    await adminContext.addCookies(boss.cookies);
    const tabA = await adminContext.newPage();
    await tabA.goto("/admin/alerts");
    await expect(tabA.getByRole("button", { name: /Farida Banu/ })).toBeVisible();

    // The support list (laptop) stays open; a marker proves it is never reloaded.
    await page.goto("/support");
    const row = page.getByRole("listitem").filter({ hasText: no });
    await expect(row.getByText("Created", { exact: true })).toBeVisible();
    await page.evaluate(() => {
      (window as unknown as { __kept: boolean }).__kept = true;
    });

    // --- Customer's own phone: a second browser context at 360 px ---
    const phoneContext = await browser.newContext({
      baseURL: base,
      viewport: { width: 360, height: 780 },
      hasTouch: true,
    });
    const phone = await phoneContext.newPage();
    await phone.goto(path);
    await expect(phone.getByRole("heading", { name: /^Hi Ramesh Kumar/ })).toBeVisible();
    const notice = phone.getByRole("complementary", { name: "Privacy notice" });
    await expect(notice).toContainText("3 years");
    await expect(notice.getByRole("link", { name: "How we use your answers" })).toBeVisible();
    expect(
      await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    ).toBeLessThanOrEqual(0);
    await phone.screenshot({ path: `.results/T-11b/journey-2-customer-welcome-360.png` });

    // Laptop: Opened shows up without a reload.
    await page.mouse.move(100, 100);
    await expect(row.getByText("Opened", { exact: true })).toBeVisible({ timeout: POLL_WAIT });
    await shot(page, "journey-3-laptop-opened");

    // The customer answers with Q4 = 1 and Q10 = Yes (S-12) and submits.
    await fillUntilCallback(phone, 1);
    await answerCallback(phone, "Yes");
    await submitForm(phone);
    await expect(phone.getByRole("heading", { name: "Thank you for your feedback" })).toBeVisible();
    await expect(phone.getByText("Our team will call you: Evening 3 PM–6 PM")).toBeVisible();
    await phone.screenshot({ path: `.results/T-11b/journey-4-customer-thanks-360.png` });
    await phoneContext.close();

    await page.mouse.move(120, 120);
    await expect(row.getByText("Completed", { exact: true })).toBeVisible({ timeout: POLL_WAIT });
    expect(await page.evaluate(() => (window as unknown as { __kept?: boolean }).__kept)).toBe(
      true,
    );
    await shot(page, "journey-5-laptop-completed");

    // --- S-06: tab A is stale (no reload). Moving the older alert must not lose the new one ---
    await setStatus(tabA, "Farida Banu", "Contacted", "Called Farida");
    await tabA.reload();
    const ramesh = tabA.getByRole("button", { name: /Ramesh Kumar/ });
    await expect(ramesh).toHaveAttribute("data-status", "open");
    await expect(tabA.getByRole("button", { name: /Farida Banu/ })).toHaveAttribute(
      "data-status",
      "contacted",
    );
    await shot(tabA, "journey-6-alerts-open");

    // --- Alert: Open -> Contacted -> Resolved ---
    await setStatus(tabA, "Ramesh Kumar", "Contacted", NOTE);
    await expect(ramesh).toHaveAttribute("data-status", "contacted");
    await setStatus(tabA, "Ramesh Kumar", "Resolved");
    await expect(ramesh).toHaveAttribute("data-status", "resolved");
    await shot(tabA, "journey-7-alert-resolved");

    // --- Everything is in the audit, with the branch ---
    const alerts = await rpcCall<AlertRow[]>(boss.api, "alerts", "listAlerts", [{}]);
    const mine = alerts.find((a) => a.customerName === "Ramesh Kumar");
    expect(mine?.status).toBe("resolved");
    const admin = await sharedAdminApi(playwright, base);
    const audit = await rpcCall<{ entries: { action: string; entityId: string }[] }>(
      admin,
      "audit",
      "listAudit",
      [{ branchId }],
    );
    expect(audit.entries.map((e) => e.action)).toEqual(
      expect.arrayContaining(["jobcard.create", "link.create", "alert.create", "alert.status"]),
    );
    expect(
      audit.entries.filter((e) => e.entityId === mine?.id && e.action === "alert.status").length,
    ).toBeGreaterThanOrEqual(2);
    await tabA.goto("/admin/audit");
    await expect(
      tabA.getByTestId("audit-row").filter({ hasText: "Alert status changed" }).first(),
    ).toBeVisible();
    await shot(tabA, "journey-8-audit");
    await adminContext.close();
  });
});
