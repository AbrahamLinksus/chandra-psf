/* eslint-disable max-lines-per-function, max-lines -- scenario tests read top to bottom */
import { expect, test, type Page } from "@playwright/test";

const DAY = 86_400_000;
const PHONE = "+91 98400 12345";

/** Same shape the app issues: base64url(JSON payload) + "." + 8 characters (LLD 9 Token). */
function makeToken(
  visitId: string,
  ageDays: number,
  jobCardNo = "JC-24-1042",
  expiresAt?: Date,
): string {
  const created = new Date(Date.now() - ageDays * DAY);
  const payload = {
    v: visitId,
    j: jobCardNo,
    c: created.toISOString(),
    e: (expiresAt ?? new Date(created.getTime() + 7 * DAY)).toISOString(),
    p: PHONE,
  };
  return `${Buffer.from(JSON.stringify(payload)).toString("base64url")}.abcd2345`;
}

/** "14 Nov" for the seeded service date (7 days ago in IST). */
function serviceDateText(): string {
  const ist = new Date(Date.now() + 5.5 * 3_600_000 - 7 * DAY);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  }).format(ist);
}

async function stored<T>(page: Page, name: string): Promise<T[]> {
  return page.evaluate(
    (key) => JSON.parse(window.localStorage.getItem(key) ?? "[]") as unknown,
    `psf:v1:${name}`,
  ) as Promise<T[]>;
}

interface VisitRow {
  id: string;
  openedAt: string | null;
  completedAt: string | null;
}
interface AlertRow {
  responseId: string;
  reasons: { kind: string; code?: string }[];
}
interface ResponseRow {
  id: string;
  visitId: string;
  answers: Record<string, unknown>;
}

/** Waits until every finite animation/transition on the page has finished (no fixed sleeps). */
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

const shot = async (page: Page, name: string): Promise<void> => {
  await settle(page);
  await page.screenshot({ path: `.results/T-04/${name}.png` });
};

const q = (page: Page, code: string) => page.locator(`[data-question="${code}"]`);
const rate = (page: Page, code: string, label: string) =>
  q(page, code).getByRole("button", { name: label });
const chip = (page: Page, code: string, name: string) =>
  q(page, code).getByRole("button", { name, exact: true });
const next = (page: Page) => page.getByRole("button", { name: "Next", exact: true });

async function patchVisit(page: Page, id: string, patch: Record<string, unknown>): Promise<void> {
  await page.evaluate(
    ([key, visitId, changes]) => {
      const list = JSON.parse(window.localStorage.getItem(key) ?? "[]") as {
        id: string;
      }[];
      const out = list.map((v) => (v.id === visitId ? { ...v, ...(changes as object) } : v));
      window.localStorage.setItem(key, JSON.stringify(out));
    },
    ["psf:v1:visits", id, patch] as const,
  );
}

async function fillStep1Happy(page: Page): Promise<void> {
  await rate(page, "Q1", "5 Excellent").click();
  await chip(page, "Q2", "Yes").click();
  await chip(page, "Q3", "No").click();
}

async function fillSteps2to4Happy(page: Page): Promise<void> {
  await chip(page, "Q4", "Yes").click();
  await chip(page, "Q5", "Yes").click();
  await rate(page, "Q6", "5 Excellent").click();
  await next(page).click();
  await chip(page, "Q7", "Yes").click();
  await chip(page, "Q8", "Yes").click();
  await chip(page, "Q9", "Yes").click();
  await next(page).click();
  await chip(page, "Q10", "Yes").click();
  await rate(page, "Q11", "5 Excellent").click();
  await next(page).click();
}

test.describe("T-04 customer feedback form", () => {
  test("welcome greets the customer and marks the visit Opened; steps fit 360 px with big targets (AC-3, AC-11)", async ({
    page,
  }) => {
    const token = makeToken("v-t04-welcome", 1);
    await page.goto(`/f/${token}`);
    await expect(
      page.getByRole("heading", {
        name: `Hi Ramesh Kumar, how was your Activa 6G's service on ${serviceDateText()}?`,
      }),
    ).toBeVisible();
    await expect(page.getByText("Takes about 2 minutes")).toBeVisible();
    await expect
      .poll(
        async () =>
          (await stored<VisitRow>(page, "visits")).find((v) => v.id === "v-t04-welcome")?.openedAt,
      )
      .not.toBeNull();
    await shot(page, `welcome-${String(page.viewportSize()?.width)}`);

    await page.getByRole("button", { name: "Start" }).click();
    await expect(page.getByText("Step 1 of 6").first()).toBeVisible();
    await expect(page.getByText("Very poor").first()).toBeVisible();
    await expect(next(page)).toBeDisabled();
    await rate(page, "Q1", "5 Excellent").click();
    await chip(page, "Q2", "Yes").click();
    await expect(next(page)).toBeDisabled();
    await chip(page, "Q3", "No").click();
    await expect(next(page)).toBeEnabled();

    // tap targets >= 48 px and nothing wider than the screen
    const buttons = page.locator("main button");
    for (const b of await buttons.all()) {
      const box = await b.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(48);
    }
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    await next(page).click();
    await expect(page.getByText("Step 2 of 6").first()).toBeVisible();
    await page.getByRole("button", { name: "Back" }).click();
    await expect(rate(page, "Q1", "5 Excellent")).toHaveAttribute("aria-pressed", "true");
    await expect(chip(page, "Q2", "Yes")).toHaveAttribute("aria-pressed", "true");
    await shot(page, `step1-${String(page.viewportSize()?.width)}`);
  });

  test("s04 unhappy customer changes their mind, reloads on step 4 and submits; alert raised (S-04, AC-4, AC-7, S-12)", async ({
    page,
  }) => {
    const token = makeToken("v-t04-s04", 1);
    await page.goto(`/f/${token}`);
    await page.getByRole("button", { name: "Start" }).click();

    // Step 1: Q1 = 2 opens Q1a
    await expect(q(page, "Q1a")).toHaveCount(0);
    await rate(page, "Q1", "2 Poor").click();
    await expect(q(page, "Q1a")).toBeVisible();
    await expect(q(page, "Q1a").getByRole("button")).toHaveText([
      "Problem not fixed",
      "Same problem came back",
      "New problem appeared",
      "Other",
    ]);
    await expect(next(page)).toBeDisabled();
    await chip(page, "Q1a", "Same problem came back").click();
    await chip(page, "Q2", "Yes").click();
    await chip(page, "Q3", "No").click();
    await next(page).click();

    // Step 2
    await chip(page, "Q4", "Yes").click();
    await chip(page, "Q5", "Yes").click();
    await rate(page, "Q6", "4 Good").click();
    await next(page).click();

    // Step 3: Q7 No opens Q7a, back to Yes hides it
    await chip(page, "Q7", "No").click();
    await expect(q(page, "Q7a")).toBeVisible();
    await chip(page, "Q7a", "1 day late").click();
    await chip(page, "Q7", "Yes").click();
    await expect(q(page, "Q7a")).toHaveCount(0);
    await chip(page, "Q8", "Yes").click();
    await chip(page, "Q9", "Yes").click();
    await next(page).click();

    // Step 4, then reload (phone locks)
    await expect(page.getByText("Step 4 of 6").first()).toBeVisible();
    await chip(page, "Q10", "Yes").click();
    await page.reload();
    await expect(page.getByText("Step 4 of 6").first()).toBeVisible();
    await expect(chip(page, "Q10", "Yes")).toHaveAttribute("aria-pressed", "true");
    await rate(page, "Q11", "4 Good").click();
    await next(page).click();
    await page.getByRole("button", { name: "Back" }).click();
    await page.getByRole("button", { name: "Back" }).click();
    await page.getByRole("button", { name: "Back" }).click();
    await page.getByRole("button", { name: "Back" }).click();
    await expect(rate(page, "Q1", "2 Poor")).toHaveAttribute("aria-pressed", "true");
    await expect(chip(page, "Q1a", "Same problem came back")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    for (let i = 0; i < 4; i++) await next(page).click();

    // Step 5 and 6
    await rate(page, "Q12", "1 Very poor").click();
    await chip(page, "Q13", "Yes").click();
    await q(page, "Q14").getByRole("textbox").fill("Brake noise still there");
    await next(page).click();
    await chip(page, "Q15", "Yes").click();
    await page.getByRole("button", { name: "Submit" }).click();

    await expect(page.getByTestId("success-animation")).toBeVisible();
    await expect(page.getByText("Our team will call you soon")).toBeVisible();
    await shot(page, `thanks-${String(page.viewportSize()?.width)}`);

    // This browser now holds the visit, the response and the alert (S-12)
    const visit = (await stored<VisitRow>(page, "visits")).find((v) => v.id === "v-t04-s04");
    expect(visit?.openedAt).not.toBeNull();
    expect(visit?.completedAt).not.toBeNull();
    const response = (await stored<ResponseRow>(page, "responses")).find(
      (r) => r.visitId === "v-t04-s04",
    );
    expect(response).toBeDefined();
    expect(response?.answers["Q7"]).toBe("Yes");
    expect(response?.answers).not.toHaveProperty("Q7a");
    expect(response?.answers["Q14"]).toBe("Brake noise still there");
    const alerts = (await stored<AlertRow>(page, "alerts")).filter(
      (a) => a.responseId === response?.id,
    );
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.reasons).toEqual([{ kind: "callback" }, { kind: "low_rating", code: "Q12" }]);

    // Opening the same link again is now "already submitted"
    await page.goto(`/f/${token}`);
    await expect(page.getByText("Thank you — already submitted")).toBeVisible();
  });

  test("a seeded completed link says already submitted (AC-5)", async ({ page }) => {
    await page.goto(`/f/${makeToken("v-s001", 1, "JC-24-1001")}`);
    await expect(page.getByText("Thank you — already submitted")).toBeVisible();
  });

  test("a link made 8 days ago shows the expired page (AC-5)", async ({ page }) => {
    await page.goto(`/f/${makeToken("v-t04-old", 8)}`);
    await expect(
      page.getByText("This feedback link has expired. Please contact Chandra Honda."),
    ).toBeVisible();
    await expect(page.getByText("A newer link was sent to you on WhatsApp")).toHaveCount(0);
    await shot(page, `expired-${String(page.viewportSize()?.width)}`);
  });

  test("s05 an old link after Regenerate says a newer link was sent on WhatsApp (S-05)", async ({
    page,
  }) => {
    const token = makeToken("v-t04-s05", 1);
    await page.goto(`/f/${token}`);
    await expect(page.getByRole("button", { name: "Start" })).toBeVisible();
    await patchVisit(page, "v-t04-s05", { replacedBy: "v-t04-s05-new" });
    await page.goto(`/f/${token}`);
    await expect(
      page.getByText("This feedback link has expired. Please contact Chandra Honda."),
    ).toBeVisible();
    await expect(page.getByText("A newer link was sent to you on WhatsApp")).toBeVisible();
  });

  test("s14 unknown and cancelled links say Link not valid (S-14, G-01)", async ({ page }) => {
    await page.goto("/f/not-a-real-token");
    await expect(page.getByText("Link not valid")).toBeVisible();

    const token = makeToken("v-t04-s14", 1);
    await page.goto(`/f/${token}`);
    await expect(page.getByRole("button", { name: "Start" })).toBeVisible();
    await patchVisit(page, "v-t04-s14", { cancelledAt: new Date().toISOString() });
    await page.goto(`/f/${token}`);
    await expect(page.getByText("Link not valid")).toBeVisible();
    await expect(page.getByRole("button", { name: "Start" })).toHaveCount(0);
  });

  test("s13 long Tamil/emoji/<script> comment is capped at 1,000, a failed save keeps answers and Retry works (S-13, G-05, G-W3)", async ({
    page,
  }) => {
    const token = makeToken("v-t04-s13", 1);
    await page.goto(`/f/${token}?demoFail=1`);
    await page.getByRole("button", { name: "Start" }).click();
    await fillStep1Happy(page);
    await next(page).click();
    await chip(page, "Q4", "Yes").click();
    await chip(page, "Q5", "Yes").click();
    await rate(page, "Q6", "5 Excellent").click();
    await next(page).click();
    await chip(page, "Q7", "Yes").click();
    await chip(page, "Q8", "Yes").click();
    await chip(page, "Q9", "Yes").click();
    await next(page).click();
    await chip(page, "Q10", "Yes").click();
    await rate(page, "Q11", "5 Excellent").click();
    await next(page).click();
    await rate(page, "Q12", "4 Good").click();
    await chip(page, "Q13", "Yes").click();

    const unit = "<script>alert(1)</script> வணக்கம் 😀 ";
    const box = q(page, "Q14").getByRole("textbox");
    await box.fill(unit.repeat(80)); // far over 1,000 characters
    await expect(q(page, "Q14").getByText("1000/1000")).toBeVisible();
    expect((await box.inputValue()).length).toBeLessThanOrEqual(1000);
    await next(page).click();
    await chip(page, "Q15", "No").click();

    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page.getByText("Couldn't save, try again")).toBeVisible();
    await expect(page.getByTestId("success-animation")).toHaveCount(0);
    await shot(page, `save-failed-${String(page.viewportSize()?.width)}`);
    await expect(chip(page, "Q15", "No")).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByTestId("success-animation")).toBeVisible();
    await expect(page.getByText("Our team will call you soon")).toHaveCount(0);
    const response = (await stored<ResponseRow>(page, "responses")).find(
      (r) => r.visitId === "v-t04-s13",
    );
    const saved = response?.answers["Q14"] as string;
    expect(saved.length).toBeLessThanOrEqual(1000);
    expect(saved).toContain("<script>alert(1)</script>");
    expect(saved).toContain("வணக்கம்");
    expect(saved).toContain("😀");
  });

  test("a <script> comment is shown as plain text, never run (G-05)", async ({ page }) => {
    await page.goto(`/f/${makeToken("v-t04-xss", 1)}`);
    await page.getByRole("button", { name: "Start" }).click();
    await fillStep1Happy(page);
    await next(page).click();
    await fillSteps2to4Happy(page);
    await rate(page, "Q12", "4 Good").click();
    await chip(page, "Q13", "No").click();
    await q(page, "Q13a").getByRole("textbox").fill("<img src=x onerror=window.__xss=1>");
    await expect(q(page, "Q13a").getByRole("textbox")).toHaveValue(
      "<img src=x onerror=window.__xss=1>",
    );
    expect(
      await page.evaluate(() => (window as unknown as { __xss?: number }).__xss),
    ).toBeUndefined();
    await expect(q(page, "Q13a").getByText("34/1000")).toBeVisible();
  });
  test("a link that expires while the form is open shows Expired on Submit, not Couldn't save (AC-5)", async ({
    page,
  }) => {
    const expiresAt = new Date(Date.now() + 6000);
    await page.goto(`/f/${makeToken("v-t04-midexp", 1, "JC-24-1042", expiresAt)}`);
    await page.getByRole("button", { name: "Start" }).click();
    await fillStep1Happy(page);
    await next(page).click();
    await fillSteps2to4Happy(page);
    await rate(page, "Q12", "4 Good").click();
    await chip(page, "Q13", "Yes").click();
    await next(page).click();
    await chip(page, "Q15", "No").click();
    await page.waitForFunction((t) => Date.now() > t, expiresAt.getTime());
    await page.getByRole("button", { name: "Submit" }).click();
    await expect(
      page.getByText("This feedback link has expired. Please contact Chandra Honda."),
    ).toBeVisible();
    await expect(page.getByText("Couldn't save, try again")).toHaveCount(0);
    await expect(page.getByTestId("success-animation")).toHaveCount(0);
    expect(
      (await stored<ResponseRow>(page, "responses")).some((r) => r.visitId === "v-t04-midexp"),
    ).toBe(false);
    await shot(page, `expired-submit-${String(page.viewportSize()?.width)}`);
  });

  test("a follow-up slides closed, is hidden from keyboard and screen readers while closing, then removed (AC-4)", async ({
    page,
  }) => {
    await page.goto(`/f/${makeToken("v-t04-anim", 1)}`);
    await page.getByRole("button", { name: "Start" }).click();
    await rate(page, "Q1", "2 Poor").click();
    await expect(q(page, "Q1a")).toBeVisible();
    const wrapper = q(page, "Q1a").locator("xpath=ancestor::div[@aria-hidden][1]");
    await expect(wrapper).toHaveAttribute("aria-hidden", "false");
    if (page.viewportSize()?.width === 360) {
      await settle(page);
      await shot(page, "step1-followup-360");
    }
    await rate(page, "Q1", "4 Good").click();
    await expect(wrapper).toHaveAttribute("aria-hidden", "true");
    await expect(wrapper).toHaveAttribute("inert", "");
    await expect(q(page, "Q1a")).toHaveCount(0);
  });

  test("with reduced motion the follow-up still opens and closes, with no transition (AC-4)", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/f/${makeToken("v-t04-rm", 1)}`);
    await page.getByRole("button", { name: "Start" }).click();
    await rate(page, "Q1", "2 Poor").click();
    await expect(q(page, "Q1a")).toBeVisible();
    const wrapper = q(page, "Q1a").locator("xpath=ancestor::div[@aria-hidden][1]");
    await expect(wrapper).toHaveCSS("transition-property", "none");
    await rate(page, "Q1", "5 Excellent").click();
    await expect(q(page, "Q1a")).toHaveCount(0);
  });

  test("the selected answer and the progress bar are the brand red, an unselected one is not (AC-11)", async ({
    page,
  }) => {
    await page.goto(`/f/${makeToken("v-t04-red", 1)}`);
    await page.getByRole("button", { name: "Start" }).click();
    const bg = (loc: ReturnType<Page["locator"]>) =>
      loc.evaluate((el) => getComputedStyle(el).backgroundColor);
    const brand = await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.className = "bg-primary";
      document.body.appendChild(probe);
      const colour = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return colour;
    });
    expect(brand).not.toBe("rgba(0, 0, 0, 0)");
    const yes = chip(page, "Q2", "Yes");
    const no = chip(page, "Q2", "No");
    await yes.click();
    await settle(page);
    expect(await bg(yes)).toBe(brand);
    expect(await bg(no)).not.toBe(brand);
    await expect(page.locator('[data-slot="progress-indicator"]')).toBeVisible();
    expect(await bg(page.locator('[data-slot="progress-indicator"]'))).toBe(brand);
  });

  test("screenshots of steps 2 and 6 at phone and desktop size (AC-11)", async ({ page }) => {
    await page.goto(`/f/${makeToken("v-t04-shots", 1)}`);
    await page.getByRole("button", { name: "Start" }).click();
    await fillStep1Happy(page);
    await next(page).click();
    await expect(page.getByText("Step 2 of 6").first()).toBeVisible();
    await shot(page, page.viewportSize()?.width === 360 ? "step2-360" : "step2-desktop");
    await chip(page, "Q4", "Yes").click();
    await chip(page, "Q5", "Yes").click();
    await rate(page, "Q6", "5 Excellent").click();
    await next(page).click();
    await chip(page, "Q7", "Yes").click();
    await chip(page, "Q8", "Yes").click();
    await chip(page, "Q9", "Yes").click();
    await next(page).click();
    await chip(page, "Q10", "Yes").click();
    await rate(page, "Q11", "5 Excellent").click();
    await next(page).click();
    await rate(page, "Q12", "4 Good").click();
    await chip(page, "Q13", "Yes").click();
    await next(page).click();
    await expect(page.getByText("Step 6 of 6").first()).toBeVisible();
    await chip(page, "Q15", "No").click();
    if (page.viewportSize()?.width === 360) await shot(page, "step6-360");
  });
});
