/* eslint-disable max-lines-per-function -- one long scenario: the wait is the test */
import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { previewUrl } from "./env";
import { buildWorld } from "./world";

const OUT = ".results/T-23";
const MIN = 60_000;
const IDLE_MS = 15 * MIN;
const GRACE_MS = 10_000;
const QUIET_MS = MIN;

test("@idle an idle tab makes no requests after 15 min and refreshes at once on return (G-6, S-23)", async ({
  browser,
  playwright,
}) => {
  test.setTimeout(25 * MIN);
  mkdirSync(OUT, { recursive: true });
  const world = await buildWorld(playwright, { admins: false });
  const context = await browser.newContext({
    baseURL: previewUrl(),
    viewport: { width: 1440, height: 900 },
  });
  await context.addCookies(world.support.cookies);
  const page = await context.newPage();

  const log: { tMs: number; method: string; path: string }[] = [];
  let t0 = Date.now();
  page.on("request", (r) => {
    const path = new URL(r.url()).pathname;
    if (path.startsWith("/api/rpc")) log.push({ tMs: Date.now() - t0, method: r.method(), path });
  });

  // Page load counts as use; from here on no input of any kind reaches the page.
  await page.goto("/support");
  t0 = Date.now();
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await page.screenshot({ path: `${OUT}/idle-1-start.png` });

  // Sanity: the capture works and the poller is running while the tab is in use.
  await expect
    .poll(() => log.filter((e) => e.tMs > 0).length, { timeout: 45_000 })
    .toBeGreaterThan(0);

  const quietFrom = IDLE_MS + GRACE_MS;
  await page.waitForTimeout(quietFrom - (Date.now() - t0));
  const before = log.length;
  await page.waitForTimeout(QUIET_MS);
  const during = log.slice(before);
  await page.screenshot({ path: `${OUT}/idle-2-after-15min.png` });

  // Return: one key press must refresh within 5 s.
  const returnedAtMs = Date.now() - t0;
  const back = page.waitForRequest((r) => new URL(r.url()).pathname.startsWith("/api/rpc"), {
    timeout: 5_000,
  });
  await page.keyboard.press("Shift");
  await back;
  await page.screenshot({ path: `${OUT}/idle-3-returned.png` });

  writeFileSync(
    `${OUT}/idle-requests.json`,
    JSON.stringify(
      {
        returnedAtMs,
        quietWindow: { fromMs: quietFrom, toMs: quietFrom + QUIET_MS, requests: during },
        all: log,
      },
      null,
      2,
    ),
  );
  expect(during).toEqual([]);
  await context.close();
});
