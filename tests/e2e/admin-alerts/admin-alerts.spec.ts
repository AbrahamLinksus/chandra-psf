/* eslint-disable max-lines-per-function -- each test plays one scenario end to end */
import { expect, test, type Browser, type Page, type PlaywrightWorkerArgs } from "@playwright/test";
import { createUser, listBranches, rpcCall, type AppApi } from "../../support/e2e";
import { sharedAdminApi, sharedAdminInBrowser } from "../admin-users/sharedAdmin";
import { newBranch, newStaff } from "../support-links/helpers";

type Playwright = PlaywrightWorkerArgs["playwright"];
type Cookies = Awaited<ReturnType<AppApi["request"]["storageState"]>>["cookies"];
const SHOT = ".results/T-07b";
const TEMP = "Temp-Pass-4471";
const OWN = "My-Own-Pass-2026!";
const NOTE = "Called, bike rechecked 22 Nov";
const STALE = "Someone else changed this alert. Reload to see the latest.";
const width = (page: Page): string => String(page.viewportSize()?.width);
const uniq = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

// Q12 = 1 and Q15 = Yes: raises one alert for the visit's branch.
const ANSWERS = {
  Q1: 5,
  Q2: "Yes",
  Q3: "No",
  Q4: "Yes",
  Q5: "Yes",
  Q6: 5,
  Q7: "Yes",
  Q8: "Yes",
  Q9: "Yes",
  Q10: "Yes",
  Q11: 5,
  Q12: 1,
  Q13: "Yes",
  Q15: "Yes",
};

interface Scene {
  branchId: string;
  branchName: string;
  advisorId: string;
  customer: string;
  admin: AppApi;
  boss: AppApi;
  cookies: Cookies;
}

interface AlertRow {
  id: string;
  customerName: string;
  version: number;
  status: string;
}

/** A new branch with one open alert (customer `customer`) and a branch admin signed in. */
async function scene(playwright: Playwright, base: string, customer: string): Promise<Scene> {
  const { branchId, advisorId, staff } = await newBranch(playwright, base, {
    label: "Velachery",
    name: "Priya",
  });
  const card = await rpcCall<{ id: string }>(staff.api, "jobCards", "createJobCard", [
    {
      requestId: crypto.randomUUID(),
      jobCardNo: `JC-24-${String(1000 + Math.floor(Math.random() * 8999))}`,
      customerName: customer,
      phone: "98400 12345",
      regNo: "tn09bx4521",
      model: "Activa 6G",
      serviceType: "Paid service",
      serviceDate: new Date().toISOString().slice(0, 10),
      advisorId,
    },
  ]);
  const out = await rpcCall<{ url: string }>(staff.api, "visits", "createVisitLink", [
    { jobCardId: card.id },
  ]);
  const code = new URL(out.url).pathname.replace("/f/", "");
  await rpcCall(staff.api, "feedback", "submitResponse", [code, ANSWERS]);

  const admin = await sharedAdminApi(playwright, base);
  const email = `bos${uniq()}@ch.in`;
  await createUser(admin, {
    name: "Meena",
    email,
    tempPassword: TEMP,
    role: "branch_admin",
    branchId,
  });
  const request = await playwright.request.newContext({ baseURL: base });
  const boss = { request, origin: new URL(base).origin };
  await rpcCall(boss, "auth", "signIn", [email, TEMP]);
  await rpcCall(boss, "auth", "setOwnPassword", [OWN]);
  const cookies = (await request.storageState()).cookies;
  const branchName = (await listBranches(admin)).find((b) => b.id === branchId)?.name ?? "";
  return { branchId, branchName, advisorId, customer, admin, boss, cookies };
}

const listAs = (api: AppApi) => rpcCall<AlertRow[]>(api, "alerts", "listAlerts", [{}]);

/** A new browser window signed in as the scene's branch admin, at the same size as `page`. */
async function asBoss(browser: Browser, page: Page, s: Scene, base: string): Promise<Page> {
  const context = await browser.newContext({ baseURL: base, viewport: page.viewportSize() });
  await context.addCookies(s.cookies);
  return context.newPage();
}

const card = (page: Page, name: string) => page.getByRole("button", { name: new RegExp(name) });

async function toContacted(page: Page, name: string): Promise<void> {
  await card(page, name).click();
  await page.getByRole("button", { name: "Contacted", exact: true }).last().click();
  await page.getByLabel("Add a note").fill(NOTE);
  await page.getByRole("button", { name: "Save", exact: true }).click();
}

async function updateAs(api: AppApi, args: unknown[]) {
  const res = await api.request.post("/api/rpc/alerts/updateAlert", {
    headers: { origin: api.origin },
    data: { args },
  });
  return (await res.json()) as { ok: boolean; error?: { code: string } };
}

test.describe("T-07b alerts queue on the server", () => {
  test("US-13 the branch admin sees only their branch's alerts and badge count (S-30)", async ({
    browser,
    page,
    playwright,
    baseURL,
  }) => {
    const base = String(baseURL);
    const mine = `Kavitha ${uniq()}`;
    const other = `Zainab ${uniq()}`;
    const s = await scene(playwright, base, mine);
    const otherScene = await scene(playwright, base, other);
    const boss = await asBoss(browser, page, s, base);
    await boss.goto("/admin/alerts");
    await expect(boss.getByRole("heading", { name: "Alerts" })).toBeVisible();
    await expect(card(boss, mine)).toBeVisible();
    await expect(boss.locator("li > button[data-status]")).toHaveCount(1);
    await expect(boss.getByText(other)).toHaveCount(0);
    await expect(boss.getByRole("combobox", { name: "Branch" })).toHaveCount(0);
    await expect(boss.getByTestId("alert-branch")).toHaveCount(0);
    if (Number(width(page)) >= 768) {
      await expect(boss.getByLabel(/\d+ open/).first()).toHaveText("1");
    } else {
      await expect(
        boss
          .getByRole("navigation", { name: "Admin tabs" })
          .locator('a[href="/admin/alerts"] .bg-brand'),
      ).toHaveCount(1);
    }
    expect(await rpcCall(s.boss, "alerts", "countOpen", [])).toBe(1);
    await boss.screenshot({ path: `${SHOT}/branch-admin-${width(page)}.png` });
    await boss.context().close();
    // AC-6 (US-29, G-W2): another branch's alert is Not found; support is FORBIDDEN
    const theirId = (await listAs(otherScene.boss))[0]?.id;
    expect(await updateAs(s.boss, [theirId, { status: "contacted" }, 1])).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
    const support = await newStaff(playwright, base, {
      branchId: s.branchId,
      advisorId: s.advisorId,
      name: "Arun",
    });
    expect(await updateAs(support.api, [theirId, { status: "contacted" }, 1])).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
    const res = await support.api.request.post("/api/rpc/alerts/listAlerts", {
      headers: { origin: support.api.origin },
      data: { args: [] },
    });
    expect(await res.json()).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  });

  test("US-13 the main admin sees every branch with a branch label and a Branch filter", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const base = String(baseURL);
    const a = await scene(playwright, base, `Kavitha ${uniq()}`);
    const b = await scene(playwright, base, `Zainab ${uniq()}`);
    await sharedAdminInBrowser(page, playwright, base);
    await page.goto("/admin/alerts");
    await expect(card(page, a.customer)).toBeVisible();
    await expect(card(page, b.customer)).toBeVisible();
    const label = card(page, a.customer).getByTestId("alert-branch");
    await expect(label).toContainText(a.branchName);
    await expect(card(page, b.customer).getByTestId("alert-branch")).toContainText(b.branchName);
    await page.screenshot({ path: `${SHOT}/main-admin-${width(page)}.png` });

    await page.getByRole("combobox", { name: "Branch" }).click();
    await page.getByRole("option", { name: a.branchName, exact: true }).click();
    await expect(card(page, a.customer)).toBeVisible();
    await expect(card(page, b.customer)).toHaveCount(0);
    await page.screenshot({ path: `${SHOT}/main-admin-filtered-${width(page)}.png` });
    await page.getByRole("combobox", { name: "Branch" }).click();
    await page.getByRole("option", { name: "All branches" }).click();
    await expect(card(page, b.customer)).toBeVisible();
  });

  test("AC-8 Contacted with a note turns the row amber; a stale second window gets the exact message and keeps its note (S-13)", async ({
    browser,
    page,
    playwright,
    baseURL,
  }) => {
    const base = String(baseURL);
    const s = await scene(playwright, base, `Priya S ${uniq()}`);
    const boss = await asBoss(browser, page, s, base);
    const other = await asBoss(browser, page, s, base);
    for (const p of [boss, other]) {
      await p.goto("/admin/alerts");
      await expect(card(p, s.customer)).toHaveAttribute("data-status", "open");
    }
    await toContacted(boss, s.customer);
    await expect(boss.getByText(NOTE).first()).toBeVisible();
    await boss.screenshot({ path: `${SHOT}/drawer-${width(page)}.png` });
    await boss.keyboard.press("Escape");
    await expect(card(boss, s.customer)).toHaveAttribute("data-status", "contacted");
    await expect(card(boss, s.customer)).toHaveClass(/bg-warning-soft/);
    await boss.screenshot({ path: `${SHOT}/contacted-${width(page)}.png` });
    const row = (await listAs(s.boss)).find((x) => x.customerName === s.customer);
    expect(row).toMatchObject({ status: "contacted", version: 2 });
    // audit checked at unit level until T-09b's listAudit lands

    await toContacted(other, s.customer);
    await expect(other.getByText(STALE)).toBeVisible();
    await expect(other.getByRole("button", { name: "Reload" })).toBeVisible();
    await expect(other.getByLabel("Add a note")).toHaveValue(NOTE);
    await other.screenshot({ path: `${SHOT}/stale-${width(page)}.png` });
    await boss.context().close();
    await other.context().close();
  });

  test("S-13 a failed save keeps the note, and Retry then saves it", async ({
    browser,
    page,
    playwright,
    baseURL,
  }) => {
    const base = String(baseURL);
    const s = await scene(playwright, base, `Kavitha ${uniq()}`);
    const boss = await asBoss(browser, page, s, base);
    await boss.goto("/admin/alerts");
    await expect(card(boss, s.customer)).toBeVisible();
    await boss.route("**/api/rpc/alerts/updateAlert", (r) => r.abort());
    await toContacted(boss, s.customer);
    await expect(boss.getByText("Couldn't save, try again")).toBeVisible();
    await expect(boss.getByLabel("Add a note")).toHaveValue(NOTE);
    await boss.screenshot({ path: `${SHOT}/save-failed-${width(page)}.png` });
    await boss.unroute("**/api/rpc/alerts/updateAlert");
    await boss.getByRole("button", { name: "Retry" }).click();
    await expect(boss.getByLabel("Add a note")).toHaveValue("");
    await boss.context().close();
  });
});
