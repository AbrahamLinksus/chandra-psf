import type { BrowserContext, Page } from "@playwright/test";

const SESSION_KEY = "psf:v1:session";

/** Sets the session in localStorage before the app loads (no UI). Call before `page.goto`. */
export async function signInAs(page: Page, who: "admin" | "support1" | "support2"): Promise<void> {
  await page.addInitScript(
    ([key, userId]) => {
      if (key !== undefined && userId !== undefined) {
        window.localStorage.setItem(key, JSON.stringify({ userId }));
      }
    },
    [SESSION_KEY, `u-${who}`],
  );
}

/** Wipes every `psf:` key; the app reseeds on the next load. */
export async function resetDemo(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const k of Object.keys(window.localStorage)) {
      if (k.startsWith("psf:")) window.localStorage.removeItem(k);
    }
  });
}

/** A second tab in the same browser context (shares localStorage). */
export async function openSecondTab(context: BrowserContext, url: string): Promise<Page> {
  const tab = await context.newPage();
  await tab.goto(url);
  return tab;
}
