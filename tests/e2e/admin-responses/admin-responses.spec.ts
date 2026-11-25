/* eslint-disable max-lines-per-function -- each test plays one scenario end to end */
import { expect, test, type Browser, type Page, type PlaywrightWorkerArgs } from "@playwright/test";
import { createUser, rpcCall, type AppApi } from "../../support/e2e";
import { sharedAdminApi } from "../admin-users/sharedAdmin";
import { newBranch } from "../support-links/helpers";

type Playwright = PlaywrightWorkerArgs["playwright"];
type Cookies = Awaited<ReturnType<AppApi["request"]["storageState"]>>["cookies"];
const SHOT = ".results/T-08b";
const TEMP = "Temp-Pass-4471";
const OWN = "My-Own-Pass-2026!";
const STALE = "Someone else changed this. Reload to see the latest.";
const Q6 = "Were you satisfied with the behaviour of the Service Advisor?";
const Q12 = "Were you satisfied with the overall service experience?";
const Q15 = "Would you like someone from our service team to call you?";
const width = (page: Page): string => String(page.viewportSize()?.width);
const uniq = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

const BASE_ANSWERS = {
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
  Q12: 4,
  Q13: "Yes",
  Q15: "No",
};

interface Scene {
  branchId: string;
  id: string;
  customer: string;
  boss: AppApi;
  cookies: Cookies;
}

async function bossFor(
  playwright: Playwright,
  base: string,
  branchId: string,
): Promise<{ boss: AppApi; cookies: Cookies }> {
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
  return { boss, cookies: (await request.storageState()).cookies };
}

/** A new branch with one response (the given answers) and a branch admin of that branch. */
async function scene(
  playwright: Playwright,
  base: string,
  answers: Record<string, unknown>,
): Promise<Scene> {
  const { branchId, advisorId, staff } = await newBranch(playwright, base, {
    label: "Velachery",
    name: "Priya",
  });
  const customer = `Kavitha ${uniq()}`;
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
  await rpcCall(staff.api, "feedback", "submitResponse", [code, answers]);
  const { boss, cookies } = await bossFor(playwright, base, branchId);
  const rows = await rpcCall<{ id: string }[]>(boss, "responses", "listResponses", [
    { from: "2000-01-01", to: "2100-01-01" },
  ]);
  return { branchId, id: rows[0]?.id ?? "", customer, boss, cookies };
}

async function asBoss(browser: Browser, page: Page, s: Scene, base: string): Promise<Page> {
  const context = await browser.newContext({ baseURL: base, viewport: page.viewportSize() });
  await context.addCookies(s.cookies);
  return context.newPage();
}

const detail = (api: AppApi, id: string) =>
  rpcCall<{
    version: number;
    response: { answers: Record<string, unknown> };
    alert: { status: string; reasons: unknown[] } | null;
  }>(api, "responses", "getResponse", [id]);

async function pick(page: Page, group: string, value: string): Promise<void> {
  await page
    .getByRole("group", { name: group })
    .getByRole("button", { name: value, exact: true })
    .click();
}

async function confirmPassword(page: Page, password: string): Promise<void> {
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
}

async function startEdit(page: Page, edits: [string, string][]): Promise<void> {
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  for (const [q, v] of edits) await pick(page, q, v);
  await page.getByRole("button", { name: "Save changes" }).click();
}

const Q6_LOW = { ...BASE_ANSWERS, Q6: 2, Q6a: { options: ["Rude"] } };

test.describe("T-08b responses on the server", () => {
  test("AC-9 G-01 edit Q6 2 -> 4: wrong password saves nothing, right one removes Q6a", async ({
    browser,
    page,
    playwright,
    baseURL,
  }) => {
    const base = String(baseURL);
    const s = await scene(playwright, base, Q6_LOW);
    const boss = await asBoss(browser, page, s, base);
    await boss.goto(`/admin/responses/${s.id}`);
    await expect(boss.locator('[data-question="Q6a"]')).toContainText("Rude");
    await startEdit(boss, [[Q6, "4"]]);
    await expect(boss.locator('[data-question="Q6a"]')).toHaveCount(0);
    await confirmPassword(boss, "wrong-password");
    await expect(boss.getByText("Password incorrect")).toBeVisible();
    await boss.screenshot({ path: `${SHOT}/wrong-password-${width(page)}.png` });
    expect((await detail(s.boss, s.id)).response.answers["Q6"]).toBe(2);
    await confirmPassword(boss, OWN);
    await expect(boss.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
    const after = await detail(s.boss, s.id);
    expect(after.response.answers["Q6"]).toBe(4);
    expect(after.response.answers["Q6a"]).toBeUndefined();
    await boss.context().close();
  });

  test("a stale second window gets the exact message and the saved answers stay", async ({
    browser,
    page,
    playwright,
    baseURL,
  }) => {
    const base = String(baseURL);
    const s = await scene(playwright, base, Q6_LOW);
    const one = await asBoss(browser, page, s, base);
    const two = await asBoss(browser, page, s, base);
    for (const p of [one, two]) {
      await p.goto(`/admin/responses/${s.id}`);
      await expect(p.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
    }
    await startEdit(one, [[Q6, "4"]]);
    await confirmPassword(one, OWN);
    await expect(one.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
    await startEdit(two, [[Q6, "3"]]);
    await confirmPassword(two, OWN);
    await expect(two.getByRole("alert").filter({ hasText: STALE })).toBeVisible();
    await two.screenshot({ path: `${SHOT}/stale-${width(page)}.png` });
    expect((await detail(s.boss, s.id)).response.answers["Q6"]).toBe(4);
    await one.context().close();
    await two.context().close();
  });

  test("S-08 Q12 1 -> 4 auto-resolves the only-reason alert; Q15 No -> Yes opens a new one", async ({
    browser,
    page,
    playwright,
    baseURL,
  }) => {
    const base = String(baseURL);
    const s = await scene(playwright, base, { ...BASE_ANSWERS, Q12: 1 });
    const boss = await asBoss(browser, page, s, base);
    await boss.goto(`/admin/responses/${s.id}`);
    await expect(boss.getByTestId("response-alert")).toContainText("Q12 rated 1");
    await startEdit(boss, [[Q12, "4"]]);
    await confirmPassword(boss, OWN);
    await expect(boss.getByTestId("response-alert")).toContainText("Resolved");
    expect((await detail(s.boss, s.id)).alert?.status).toBe("resolved");
    await boss.screenshot({ path: `${SHOT}/auto-resolved-${width(page)}.png` });

    const t = await scene(playwright, base, BASE_ANSWERS);
    const other = await asBoss(browser, page, t, base);
    await other.goto(`/admin/responses/${t.id}`);
    await expect(other.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
    await expect(other.getByTestId("response-alert")).toHaveCount(0);
    await startEdit(other, [[Q15, "Yes"]]);
    await confirmPassword(other, OWN);
    await expect(other.getByTestId("response-alert")).toContainText("Callback requested");
    await expect(other.getByTestId("response-alert")).toContainText("Open");
    expect((await detail(t.boss, t.id)).alert?.status).toBe("open");
    await boss.context().close();
    await other.context().close();
  });

  test("US-21 S-09 G-03 delete then restore keeps the answers; Recently deleted shows when it goes for good", async ({
    browser,
    page,
    playwright,
    baseURL,
  }) => {
    const base = String(baseURL);
    const s = await scene(playwright, base, { ...BASE_ANSWERS, Q12: 1 });
    const before = JSON.stringify((await detail(s.boss, s.id)).response.answers);
    const boss = await asBoss(browser, page, s, base);
    await boss.goto(`/admin/responses/${s.id}`);
    await boss.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(boss.getByText("Delete this response?")).toBeVisible();
    await boss
      .getByRole("alertdialog")
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    await confirmPassword(boss, "wrong-password");
    await expect(boss.getByText("Password incorrect")).toBeVisible();
    await confirmPassword(boss, OWN);
    await expect(boss).toHaveURL(/\/admin\/responses$/);

    await boss.goto("/admin/responses/deleted");
    const row = boss.locator(`li[data-response-id="${s.id}"]`);
    await expect(row).toContainText(s.customer);
    await expect(row).toContainText(/Removed for good on \d{1,2} \w{3} \d{4}/);
    await boss.screenshot({ path: `${SHOT}/recently-deleted-${width(page)}.png` });
    await row.getByRole("button", { name: "Restore" }).click();
    await confirmPassword(boss, OWN);
    await expect(boss.getByText("Nothing deleted")).toBeVisible();

    const back = await detail(s.boss, s.id);
    expect(JSON.stringify(back.response.answers)).toBe(before);
    expect(back.alert?.status).toBe("open");
    await boss.context().close();
  });

  test("US-29 another branch's admin opening the response URL sees Not found and no data", async ({
    browser,
    page,
    playwright,
    baseURL,
  }) => {
    const base = String(baseURL);
    const mine = await scene(playwright, base, Q6_LOW);
    const theirs = await scene(playwright, base, Q6_LOW);
    const boss = await asBoss(browser, page, mine, base);
    await boss.goto(`/admin/responses/${theirs.id}`);
    await expect(boss.getByText("Not found")).toBeVisible();
    await expect(boss.getByText(theirs.customer)).toHaveCount(0);
    await expect(boss.locator("[data-question]")).toHaveCount(0);
    await boss.screenshot({ path: `${SHOT}/not-found-${width(page)}.png` });
    await boss.context().close();
  });

  test("S-13 a failed edit keeps the edited answers and shows 'Couldn't save, try again'", async ({
    browser,
    page,
    playwright,
    baseURL,
  }) => {
    const base = String(baseURL);
    const s = await scene(playwright, base, Q6_LOW);
    const boss = await asBoss(browser, page, s, base);
    await boss.goto(`/admin/responses/${s.id}`);
    await expect(boss.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
    await boss.route("**/api/rpc/responses/editResponse", (r) => r.abort());
    await startEdit(boss, [[Q6, "4"]]);
    await confirmPassword(boss, OWN);
    await expect(boss.getByText("Couldn't save, try again").first()).toBeVisible();
    await boss.screenshot({ path: `${SHOT}/save-failed-${width(page)}.png` });
    await boss.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(
      boss.getByRole("group", { name: Q6 }).getByRole("button", { name: "4", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await boss.unroute("**/api/rpc/responses/editResponse");
    await boss.getByRole("button", { name: "Retry" }).click();
    await confirmPassword(boss, OWN);
    await expect.poll(async () => (await detail(s.boss, s.id)).response.answers["Q6"]).toBe(4);
    await boss.context().close();
  });
});
