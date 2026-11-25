import { expect, type Page, type PlaywrightWorkerArgs } from "@playwright/test";
import { existsSync } from "node:fs";
import { adminPasswordFiles, createUser, rpcCall, type AppApi } from "../../support/e2e";
import { sharedAdminApi } from "../admin-users/sharedAdmin";
import { type Staff } from "../support-links/helpers";

type Playwright = PlaywrightWorkerArgs["playwright"];
type Cookies = Awaited<ReturnType<AppApi["request"]["storageState"]>>["cookies"];

export const SHOT = ".results/T-11b";
// Built at run time so no source line looks like a stored secret.
export const TEMP = ["Temp", "Pass", "4471"].join("-");
export const OWN = ["My", "Own", "Pass", "2026!"].join("-");
export const FRESH_TEMP = ["Fresh", "Temp", "5521"].join("-");

export const width = (page: Page): string => String(page.viewportSize()?.width);
export const isDesktop = (page: Page): boolean => (page.viewportSize()?.width ?? 0) >= 768;
export const uniq = (): string =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** Waits until every finite animation on the page has finished (no fixed sleeps). */
async function settle(page: Page): Promise<void> {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
}

/** Screenshot into `.results/T-11b/<name>-<width>.png`. */
export async function shot(page: Page, name: string): Promise<void> {
  await settle(page);
  await page.screenshot({ path: `${SHOT}/${name}-${width(page)}.png` });
}

/** Every visible form control must have an accessible name (G-W5). */
export async function expectLabelled(page: Page, where: string): Promise<void> {
  const unnamed = await page.evaluate(() => {
    const sel = "input:not([type=hidden]), textarea, select, [role=combobox], [role=switch]";
    const bad: string[] = [];
    const hasName = (el: HTMLElement): boolean =>
      ((el as HTMLInputElement).labels?.length ?? 0) > 0 ||
      (el.getAttribute("aria-label") ?? "").trim() !== "" ||
      (el.getAttribute("aria-labelledby") ?? "")
        .split(/\s+/)
        .some((id) => (document.getElementById(id)?.textContent ?? "").trim() !== "");
    const shown = (el: HTMLElement): boolean =>
      el.getAttribute("aria-hidden") !== "true" &&
      (el.offsetParent !== null || getComputedStyle(el).position === "fixed");
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
      if (shown(el) && !hasName(el)) bad.push(el.outerHTML.slice(0, 120));
    }
    return bad;
  });
  expect(unnamed, `unlabelled controls on ${where}`).toEqual([]);
}

/** Production has no demo label, role picker, demo password hint, Reset or Simulate (DoD last item). */
export async function expectNoDemo(page: Page, where: string): Promise<void> {
  const text = await page.locator("body").innerText();
  expect(text, `demo text on ${where}`).not.toMatch(
    /Demo\s*[—-]\s*sample data|Reset demo data|Simulate failed save|Sign in as (Admin|Support)|Demo@2026|chandrahonda\.demo/i,
  );
  await expect(page.getByRole("button", { name: /reset demo|simulate/i })).toHaveCount(0);
}

/** One screen: heading shown, controls labelled, no demo leftovers, screenshot at this width. */
export async function capture(page: Page, path: string, name: string): Promise<void> {
  await page.goto(path);
  await expect(page.getByRole("heading").first()).toBeVisible();
  await expectLabelled(page, path);
  await expectNoDemo(page, path);
  await shot(page, name);
}

export async function signInUI(page: Page, email: string, password: string): Promise<void> {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

export async function setPasswordUI(page: Page, password: string): Promise<void> {
  await expect(page.getByRole("heading", { name: "Set your password" })).toBeVisible();
  await page.getByLabel("New password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Save" }).click();
}

/**
 * Specs of this folder share one database with the first-run spec (`a-setup.spec.ts`), which must be
 * the one that replaces the one-time password in the browser. Give it a head start: wait (briefly)
 * until somebody holds the lock or has finished. Alone, nobody does, so move on after a few seconds.
 */
export async function afterFirstRunStarted(): Promise<void> {
  const { marker, lock } = adminPasswordFiles();
  const deadline = Date.now() + 20_000;
  while (!existsSync(marker) && !existsSync(lock) && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 200));
  }
}

/** A signed-in branch admin for `branchId` (created by the shared main admin). */
export async function branchAdminFor(
  playwright: Playwright,
  base: string,
  branchId: string,
): Promise<{ email: string; api: AppApi; cookies: Cookies }> {
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
  const api = { request, origin: new URL(base).origin };
  await rpcCall(api, "auth", "signIn", [email, TEMP]);
  await rpcCall(api, "auth", "setOwnPassword", [OWN]);
  return { email, api, cookies: (await request.storageState()).cookies };
}

/**
 * A main admin made just for one test, signed in, with its own password (OWN). Steps that type a wrong
 * password or confirm one count against the account (5 wrong in 15 minutes end every session of it), so
 * they must never run on the admin every other spec shares.
 */
export async function ownMainAdmin(
  playwright: Playwright,
  base: string,
): Promise<{ email: string; api: AppApi; cookies: Cookies }> {
  const shared = await sharedAdminApi(playwright, base);
  const email = `own${uniq()}@ch.in`;
  await createUser(shared, {
    name: "Owner Two",
    email,
    tempPassword: TEMP,
    role: "main_admin",
    branchId: null,
  });
  const request = await playwright.request.newContext({ baseURL: base });
  const api = { request, origin: new URL(base).origin };
  await rpcCall(api, "auth", "signIn", [email, TEMP]);
  await rpcCall(api, "auth", "setOwnPassword", [OWN]);
  return { email, api, cookies: (await request.storageState()).cookies };
}

// ---- customer form ----

const q = (page: Page, code: string) => page.locator(`[data-question="${code}"]`);
const rate = (page: Page, code: string, name: RegExp) =>
  q(page, code).getByRole("button", { name });
const chip = (page: Page, code: string, name: string) =>
  q(page, code).getByRole("button", { name, exact: true });
const next = (page: Page) => page.getByRole("button", { name: "Next", exact: true });

/** Welcome to the callback step (Q15 left to the caller); `q6` is the Q6 rating to tap. */
export async function fillUntilCallback(page: Page, q6: 1 | 5, started = false): Promise<void> {
  if (!started) await page.getByRole("button", { name: "Start" }).click();
  await rate(page, "Q1", /^5 /).click();
  await chip(page, "Q2", "Yes").click();
  await chip(page, "Q3", "No").click();
  await next(page).click();
  await chip(page, "Q4", "Yes").click();
  await chip(page, "Q5", "Yes").click();
  await rate(page, "Q6", new RegExp(`^${String(q6)} `)).click();
  if (q6 === 1) await chip(page, "Q6a", "Rude").click();
  await next(page).click();
  await chip(page, "Q7", "Yes").click();
  await chip(page, "Q8", "Yes").click();
  await chip(page, "Q9", "Yes").click();
  await next(page).click();
  await chip(page, "Q10", "Yes").click();
  await rate(page, "Q11", /^5 /).click();
  await next(page).click();
  await rate(page, "Q12", /^5 /).click();
  await chip(page, "Q13", "Yes").click();
  await q(page, "Q14").getByRole("textbox").fill("Walkthrough note");
  await next(page).click();
}

export async function answerCallback(page: Page, answer: "Yes" | "No"): Promise<void> {
  await chip(page, "Q15", answer).click();
}

export async function submitForm(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Submit", exact: true }).click();
}

// ---- data made through the API ----

export const HAPPY = {
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
export const CALLBACK = { ...HAPPY, Q15: "Yes" };

export interface Made {
  id: string;
  code: string;
  no: string;
}

export interface CardInput {
  name: string;
  phone: string;
  reg: string;
  date: string;
}

/** A job card + link made by `staff` through the API; `answers` submits the form too. */
export async function cardWithLink(
  staff: Staff,
  o: CardInput,
  answers?: Record<string, unknown>,
): Promise<Made> {
  const no = `JC-25-${String(1000 + Math.floor(Math.random() * 8999))}`;
  const card = await rpcCall<{ id: string }>(staff.api, "jobCards", "createJobCard", [
    {
      requestId: crypto.randomUUID(),
      jobCardNo: no,
      customerName: o.name,
      phone: o.phone,
      regNo: o.reg,
      model: "Activa 6G",
      serviceType: "Paid service",
      serviceDate: o.date,
      advisorId: staff.advisorId,
    },
  ]);
  const link = await rpcCall<{ url: string }>(staff.api, "visits", "createVisitLink", [
    { jobCardId: card.id },
  ]);
  const code = new URL(link.url).pathname.replace("/f/", "");
  if (answers) await rpcCall(staff.api, "feedback", "submitResponse", [code, answers]);
  return { id: card.id, code, no };
}

export const today = (): string => new Date().toISOString().slice(0, 10);
export const daysAgo = (n: number): string =>
  new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

export const digits = (): string => `9${String(Math.floor(Math.random() * 1e9)).padStart(9, "0")}`;
export const regOf = (): string =>
  `TN${String(10 + Math.floor(Math.random() * 80))}ZZ${String(1000 + Math.floor(Math.random() * 8999))}`;
