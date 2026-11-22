import { expect, type Page } from "@playwright/test";

const DAY = 86_400_000;

/** Same shape the app issues: base64url(JSON payload) + "." + 8 characters (LLD 9 Token). */
export function makeToken(visitId: string, ageDays: number, jobCardNo = "JC-24-1042"): string {
  const created = new Date(Date.now() - ageDays * DAY);
  const payload = {
    v: visitId,
    j: jobCardNo,
    c: created.toISOString(),
    e: new Date(created.getTime() + 7 * DAY).toISOString(),
    p: "+91 98400 12345",
  };
  return `${Buffer.from(JSON.stringify(payload)).toString("base64url")}.abcd2345`;
}

export const width = (page: Page): string => String(page.viewportSize()?.width);
export const isDesktop = (page: Page): boolean => (page.viewportSize()?.width ?? 0) >= 768;

/** Waits until every finite animation on the page has finished (no fixed sleeps). */
export async function settle(page: Page): Promise<void> {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
}

export async function shot(page: Page, name: string): Promise<void> {
  await settle(page);
  await page.screenshot({ path: `.results/T-11/${name}-${width(page)}.png` });
}

export async function stored<T>(page: Page, name: string): Promise<T[]> {
  return page.evaluate(
    (key) => JSON.parse(window.localStorage.getItem(key) ?? "[]") as unknown,
    `psf:v1:${name}`,
  ) as Promise<T[]>;
}

const q = (page: Page, code: string) => page.locator(`[data-question="${code}"]`);
const rate = (page: Page, code: string, label: string) =>
  q(page, code).getByRole("button", { name: label });
const chip = (page: Page, code: string, name: string) =>
  q(page, code).getByRole("button", { name, exact: true });
const next = (page: Page) => page.getByRole("button", { name: "Next", exact: true });

export interface FormChoice {
  q6: "1 Very poor" | "5 Excellent";
  q15: "Yes" | "No";
}

/** Completes steps 1-5 of the customer form (the page is on the welcome screen). */
export async function fillUntilCallback(page: Page, c: FormChoice): Promise<void> {
  await page.getByRole("button", { name: "Start" }).click();
  await rate(page, "Q1", "5 Excellent").click();
  await chip(page, "Q2", "Yes").click();
  await chip(page, "Q3", "No").click();
  await next(page).click();
  await chip(page, "Q4", "Yes").click();
  await chip(page, "Q5", "Yes").click();
  await rate(page, "Q6", c.q6).click();
  if (c.q6.startsWith("1")) await chip(page, "Q6a", "Rude").click();
  await next(page).click();
  await chip(page, "Q7", "Yes").click();
  await chip(page, "Q8", "Yes").click();
  await chip(page, "Q9", "Yes").click();
  await next(page).click();
  await chip(page, "Q10", "Yes").click();
  await rate(page, "Q11", "5 Excellent").click();
  await next(page).click();
  await rate(page, "Q12", "5 Excellent").click();
  await chip(page, "Q13", "Yes").click();
  await q(page, "Q14").getByRole("textbox").fill("Walkthrough note");
  await next(page).click();
}

/** Opens the link and submits the whole form. */
export async function submitForm(page: Page, path: string, c: FormChoice): Promise<void> {
  await page.goto(path);
  await fillUntilCallback(page, c);
  await chip(page, "Q15", c.q15).click();
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByTestId("success-animation")).toBeVisible();
}

/** Support top bar sign-out (phone and desktop). */
export async function signOutSupport(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
}

export async function confirmPassword(page: Page): Promise<void> {
  await page.getByLabel("Password", { exact: true }).fill("Demo@2026");
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
}

export async function moveAlert(page: Page, who: RegExp, status: string): Promise<void> {
  await page.getByRole("button", { name: who }).click();
  await page.getByRole("button", { name: status, exact: true }).last().click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.keyboard.press("Escape");
}
