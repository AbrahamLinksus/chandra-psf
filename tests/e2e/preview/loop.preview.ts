/* eslint-disable max-lines-per-function -- each test plays one scenario end to end */
import { devices, expect, test, type Browser, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { previewUrl } from "./env";
import { buildWorld, makeCard, rpcCall, uniq, type Actor, type World } from "./world";

const OUT = ".results/T-23";
const WATCH_MS = 35_000;
const customer = `Loop ${uniq()}`;
let world: World;

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ playwright }) => {
  mkdirSync(OUT, { recursive: true });
  world = await buildWorld(playwright, { admins: true });
});

const q = (page: Page, code: string) => page.locator(`[data-question="${code}"]`);
const rate = (page: Page, code: string, name: RegExp) =>
  q(page, code).getByRole("button", { name });
const chip = (page: Page, code: string, name: string) =>
  q(page, code).getByRole("button", { name, exact: true });
const next = (page: Page) => page.getByRole("button", { name: "Next", exact: true });

/** Welcome to the last step with Q1 = 1 and Q10 = Yes (Evening), then Submit. */
async function fillAndSubmit(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Start" }).click();
  await rate(page, "Q1", /^1 /).click();
  await chip(page, "Q1a", "Poor workmanship").click();
  await chip(page, "Q2", "Yes").click();
  await chip(page, "Q3", "No").click();
  await next(page).click();
  await rate(page, "Q4", /^5 /).click();
  await next(page).click();
  await chip(page, "Q5", "Yes").click();
  await chip(page, "Q6", "Yes").click();
  await next(page).click();
  await chip(page, "Q7", "Yes").click();
  await rate(page, "Q8", /^5 /).click();
  await next(page).click();
  await chip(page, "Q9", "Yes").click();
  await chip(page, "Q9a", "Quality of Service").click();
  await next(page).click();
  await chip(page, "Q10", "Yes").click();
  await chip(page, "Q10a", "Evening (3 PM–6 PM)").click();
  await page.getByRole("button", { name: "Submit", exact: true }).click();
}

async function asActor(browser: Browser, who: Actor) {
  const context = await browser.newContext({
    baseURL: previewUrl(),
    viewport: { width: 1440, height: 900 },
  });
  await context.addCookies(who.cookies);
  return context;
}

async function alertsSeenBy(who: Actor): Promise<string[]> {
  const rows = await rpcCall<{ customerName: string }[]>(who.api, "alerts", "listAlerts", [{}]);
  return rows.map((r) => r.customerName);
}

type Marked = { __noReload?: number };

test("support laptop generates a link, a 360 px phone opens and submits: Opened then Completed with no reload (DoD 5, US-05, S-12)", async ({
  browser,
}) => {
  const card = await makeCard(world, customer);
  const laptopContext = await asActor(browser, world.support);
  const laptop = await laptopContext.newPage();
  await laptop.goto("/support/new");
  await laptop.getByLabel("Job card number").first().fill(card.no);
  await laptop.getByRole("button", { name: "Look up" }).click();
  await laptop.getByRole("button", { name: "Generate link" }).click();
  const url = (await laptop.getByTestId("link-url").textContent()) ?? "";
  expect(url).toMatch(/\/f\/[A-Za-z0-9_-]{43}$/);
  test.info().annotations.push({
    type: "link-origin-matches-preview",
    description: String(new URL(url).origin === previewUrl()),
  });
  await laptop.screenshot({ path: `${OUT}/1-laptop-generated.png` });

  // Client-side navigation to My links, then a marker that only a reload would remove.
  await laptop.getByRole("link", { name: "My links" }).click();
  await expect(laptop).toHaveURL(/\/support$/);
  await laptop.evaluate(() => {
    (window as unknown as Marked).__noReload = 1;
  });
  const row = laptop.getByRole("listitem").filter({ hasText: card.no });
  await expect(row.getByText("Created", { exact: true })).toBeVisible();

  // A different device: 360 px phone, anonymous, opens the link path on the preview.
  const phoneContext = await browser.newContext({
    ...devices["Pixel 5"],
    viewport: { width: 360, height: 780 },
    baseURL: previewUrl(),
  });
  const phone = await phoneContext.newPage();
  await phone.goto(new URL(url).pathname);
  await expect(phone.getByRole("button", { name: "Start" })).toBeVisible();
  const openedAt = Date.now();
  await phone.screenshot({ path: `${OUT}/2-phone-welcome-360.png` });

  await expect(row.getByText("Opened", { exact: true })).toBeVisible({ timeout: WATCH_MS });
  const openedAfterMs = Date.now() - openedAt;
  await laptop.screenshot({ path: `${OUT}/3-laptop-opened.png` });

  await fillAndSubmit(phone);
  await expect(phone.getByRole("heading", { name: "Thank you for your feedback" })).toBeVisible();
  const submittedAt = Date.now();
  await phone.screenshot({ path: `${OUT}/4-phone-thanks-360.png` });

  await expect(row.getByText("Completed", { exact: true })).toBeVisible({ timeout: WATCH_MS });
  const completedAfterMs = Date.now() - submittedAt;
  await laptop.screenshot({ path: `${OUT}/5-laptop-completed.png` });

  expect(await laptop.evaluate(() => (window as unknown as Marked).__noReload)).toBe(1);
  writeFileSync(
    `${OUT}/loop-timings.json`,
    JSON.stringify({ openedAfterMs, completedAfterMs, noReload: true }, null, 2),
  );
  await phoneContext.close();
  await laptopContext.close();
});

test("Q10 = Yes raised an alert: Velachery's admin sees it, Tambaram's does not (S-30)", async ({
  browser,
}) => {
  const vel = await asActor(browser, world.velacheryAdmin);
  const velPage = await vel.newPage();
  await velPage.goto("/admin/alerts");
  await expect(velPage.getByRole("heading", { name: "Alerts" })).toBeVisible();
  await expect(velPage.getByRole("button", { name: new RegExp(customer) })).toBeVisible();
  await velPage.screenshot({ path: `${OUT}/6-velachery-admin-alerts.png` });

  const tam = await asActor(browser, world.tambaramAdmin);
  const tamPage = await tam.newPage();
  await tamPage.goto("/admin/alerts");
  await expect(tamPage.getByRole("heading", { name: "Alerts" })).toBeVisible();
  await expect(tamPage.getByText(customer)).toHaveCount(0);
  await tamPage.screenshot({ path: `${OUT}/7-tambaram-admin-alerts.png` });

  // The same answer straight from the server.
  expect(await alertsSeenBy(world.velacheryAdmin)).toContain(customer);
  expect(await alertsSeenBy(world.tambaramAdmin)).not.toContain(customer);
  await vel.close();
  await tam.close();
});
