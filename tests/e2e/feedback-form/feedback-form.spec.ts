/* eslint-disable max-lines-per-function -- each test plays one scenario end to end */
import { expect, test, type Page, type PlaywrightWorkerArgs } from "@playwright/test";
import { rpcCall } from "../../support/e2e";
import { makeCard, newBranch, type Staff } from "../support-links/helpers";

type Playwright = PlaywrightWorkerArgs["playwright"];
const SHOT = ".results/T-04b";
const BUSY = "Too many requests, try again in a few minutes";
const NOTES = "Do you have any additional feedback or suggestions? (optional)";

interface Issued {
  visit: { id: string; status: string };
  url: string;
}
interface Link {
  path: string;
  code: string;
  visitId: string;
  staff: Staff;
}

async function issue(playwright: Playwright, base: string): Promise<Link> {
  const { staff } = await newBranch(playwright, base, { label: "Velachery", name: "Kavitha" });
  const card = await makeCard(staff);
  const out = await rpcCall<Issued>(staff.api, "visits", "createVisitLink", [
    { jobCardId: card.id },
  ]);
  const path = new URL(out.url).pathname;
  return { path, code: path.replace("/f/", ""), visitId: out.visit.id, staff };
}

async function statusOf(l: Link): Promise<string | undefined> {
  const rows = await rpcCall<Issued["visit"][]>(l.staff.api, "visits", "listVisits", [
    { scope: "mine" },
  ]);
  return rows.find((v) => v.id === l.visitId)?.status;
}

const q = (page: Page, code: string) => page.locator(`[data-question="${code}"]`);
const rate = (page: Page, code: string, name: RegExp) =>
  q(page, code).getByRole("button", { name });
const chip = (page: Page, code: string, name: string) =>
  q(page, code).getByRole("button", { name, exact: true });
const next = (page: Page) => page.getByRole("button", { name: "Next", exact: true });
const submit = (page: Page) => page.getByRole("button", { name: "Submit", exact: true });
const width = (page: Page) => String(page.viewportSize()?.width);
const pwned = (page: Page) =>
  page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned);

/** Welcome to step 6 with Q12 = 1; `extra` runs on step 5. Leaves Q15 to the caller. */
async function fillToCallback(page: Page, extra?: () => Promise<void>): Promise<void> {
  await page.getByRole("button", { name: "Start" }).click();
  await rate(page, "Q1", /^5 /).click();
  await chip(page, "Q2", "Yes").click();
  await chip(page, "Q3", "No").click();
  await next(page).click();
  await chip(page, "Q4", "Yes").click();
  await chip(page, "Q5", "Yes").click();
  await rate(page, "Q6", /^5 /).click();
  await next(page).click();
  await chip(page, "Q7", "Yes").click();
  await chip(page, "Q8", "Yes").click();
  await chip(page, "Q9", "Yes").click();
  await next(page).click();
  await chip(page, "Q10", "Yes").click();
  await rate(page, "Q11", /^5 /).click();
  await next(page).click();
  await rate(page, "Q12", /^1 /).click();
  await chip(page, "Q13", "Yes").click();
  if (extra) await extra();
  await next(page).click();
}

async function reachSubmit(page: Page, link: Link, extra?: () => Promise<void>): Promise<void> {
  await page.goto(link.path);
  await fillToCallback(page, extra);
  await chip(page, "Q15", "Yes").click();
}

test.describe("T-04b customer form on a real server", () => {
  test("welcome: greeting, 2 minutes, SPEC notice, /privacy link; Opened only by a real browser (S-26, G-12, AC-3)", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const link = await issue(playwright, String(baseURL));
    // Fetching the HTML without running its script must not set Opened.
    const res = await page.request.get(link.path);
    expect(res.ok()).toBe(true);
    expect(await statusOf(link)).toBe("created");

    await page.goto(link.path);
    await expect(
      page.getByRole("heading", { name: /^Hi Ramesh Kumar, how was your Activa 6G's service on / }),
    ).toBeVisible();
    await expect(page.getByText("Takes about 2 minutes")).toBeVisible();
    const notice = page.getByRole("complementary", { name: "Privacy notice" });
    await expect(notice).toContainText("Chandra Honda");
    await expect(notice).toContainText("3 years");
    await expect(notice).toContainText("outside India");
    await expect(notice).toContainText("+91 00 0000 0000");
    const more = notice.getByRole("link", { name: "How we use your answers" });
    await expect(more).toHaveAttribute("href", "/privacy");
    await expect.poll(() => statusOf(link)).toBe("opened");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `${SHOT}/welcome-${width(page)}.png` });

    await more.click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.getByRole("heading", { name: "How we use your answers" })).toBeVisible();
    await page.screenshot({ path: `${SHOT}/privacy-${width(page)}.png` });
  });

  test("Q12 = 1, Q15 = Yes: thank-you with the callback line; script text stays text (AC-7, US-11, G-05, G-W3)", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const link = await issue(playwright, String(baseURL));
    const sent: unknown[][] = [];
    page.on("request", (r) => {
      if (r.url().includes("/api/rpc/feedback/submitResponse")) {
        sent.push((r.postDataJSON() as { args: unknown[] }).args);
      }
    });
    const evil = "<script>window.__pwned = 1</script>";
    await reachSubmit(page, link, async () => {
      await page.getByLabel(NOTES).fill(evil);
    });
    await submit(page).click();
    await expect(page.getByRole("heading", { name: "Thank you for your feedback" })).toBeVisible();
    await expect(page.getByText("Our team will call you soon")).toBeVisible();
    await page.screenshot({ path: `${SHOT}/thanks-${width(page)}.png` });
    expect(await pwned(page)).toBeUndefined();
    expect(sent).toHaveLength(1);
    // The client sends a submission id with every real submit (the optional parameter is unused).
    expect(sent[0]?.[2]).toMatch(/^[0-9a-f-]{36}$/);
    expect((sent[0]?.[1] as Record<string, unknown>)["Q14"]).toBe(evil);

    await expect.poll(() => statusOf(link)).toBe("completed");
    await page.goto(link.path);
    await expect(page.getByText("Thank you — already submitted")).toBeVisible();
  });

  test("script and markup typed in the box are shown as text, never run (G-05)", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const link = await issue(playwright, String(baseURL));
    const evil = '<img src=x onerror="window.__pwned=1"><script>window.__pwned=1</script>';
    await page.goto(link.path);
    await fillToCallback(page);
    await page.getByRole("button", { name: "Back" }).click();
    const box = page.getByLabel(NOTES);
    await box.fill(evil);
    await expect(box).toHaveValue(evil);
    await expect(page.locator("main img")).toHaveCount(0);
    expect(await pwned(page)).toBeUndefined();
  });

  test("a failed submit keeps every answer; Retry reuses the submission id and shows the callback line (S-13, S-29, G-15)", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const link = await issue(playwright, String(baseURL));
    const ids: unknown[] = [];
    let failures = 0;
    await page.route("**/api/rpc/feedback/submitResponse", async (route) => {
      ids.push((route.request().postDataJSON() as { args: unknown[] }).args[2]);
      if (failures === 0) {
        failures += 1;
        // The server stores the answer, but the phone never hears back; Retry then replays.
        await route.fetch();
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ ok: false, error: { code: "SAVE_FAILED", message: "x" } }),
        });
        return;
      }
      await route.continue();
    });
    await reachSubmit(page, link);
    await submit(page).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Couldn't save, try again" }),
    ).toBeVisible();
    await expect(chip(page, "Q15", "Yes")).toHaveAttribute("aria-pressed", "true");
    await page.screenshot({ path: `${SHOT}/save-failed-${width(page)}.png` });
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByRole("heading", { name: "Thank you for your feedback" })).toBeVisible();
    await expect(page.getByText("Our team will call you soon")).toBeVisible();
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe(ids[1]);
    expect(ids[0]).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("two contexts submit the same link: one response, the other sees 'Thank you — already submitted' (S-29)", async ({
    browser,
    playwright,
    baseURL,
  }) => {
    const link = await issue(playwright, String(baseURL));
    const ca = await browser.newContext({ baseURL: String(baseURL) });
    const cb = await browser.newContext({ baseURL: String(baseURL) });
    const a = await ca.newPage();
    const b = await cb.newPage();
    await reachSubmit(a, link);
    await reachSubmit(b, link);
    await submit(a).click();
    await expect(a.getByRole("heading", { name: "Thank you for your feedback" })).toBeVisible();
    await submit(b).click();
    await expect(b.getByText("Thank you — already submitted")).toBeVisible();
    await b.screenshot({ path: `${SHOT}/already-${width(b)}.png` });
    expect(await statusOf(link)).toBe("completed");
    await ca.close();
    await cb.close();
  });

  test("cancelled, replaced and unknown links show their own pages (AC-5, S-05, S-14)", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const link = await issue(playwright, String(baseURL));
    await rpcCall(link.staff.api, "visits", "cancelLink", [link.visitId]);
    await page.goto(link.path);
    await expect(page.getByText("Link not valid")).toBeVisible();
    await page.screenshot({ path: `${SHOT}/cancelled-${width(page)}.png` });

    const second = await issue(playwright, String(baseURL));
    const fresh = await rpcCall<Issued>(second.staff.api, "visits", "resendLink", [second.visitId]);
    expect(new URL(fresh.url).pathname).not.toBe(second.path);
    await page.goto(second.path);
    await expect(page.getByText("A newer link was sent to you on WhatsApp")).toBeVisible();
    await page.screenshot({ path: `${SHOT}/replaced-${width(page)}.png` });
    await page.goto(new URL(fresh.url).pathname);
    await expect(page.getByRole("button", { name: "Start" })).toBeVisible();

    await page.goto("/f/not-a-real-code");
    await expect(page.getByText("Link not valid")).toBeVisible();
  });

  test("the 6th submit on one link in an hour: 'Too many requests, try again in a few minutes' (S-22, G-7)", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const link = await issue(playwright, String(baseURL));
    const anon = await playwright.request.newContext({ baseURL: String(baseURL) });
    const origin = new URL(String(baseURL)).origin;
    for (let i = 0; i < 5; i++) {
      const res = await anon.post("/api/rpc/feedback/submitResponse", {
        headers: { origin },
        data: { args: [link.code, {}] },
      });
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe("VALIDATION");
    }
    await reachSubmit(page, link);
    await submit(page).click();
    await expect(page.getByRole("alert").filter({ hasText: BUSY })).toBeVisible();
    await expect(chip(page, "Q15", "Yes")).toHaveAttribute("aria-pressed", "true");
    await page.screenshot({ path: `${SHOT}/rate-limited-${width(page)}.png` });
    expect(await statusOf(link)).not.toBe("completed");
    await anon.dispose();
  });
});
