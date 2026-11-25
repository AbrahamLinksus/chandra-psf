/* eslint-disable max-lines-per-function -- each test plays one scenario end to end */
import { expect, test, type Page, type PlaywrightWorkerArgs } from "@playwright/test";
import { createAdvisor, createUser, listBranches, rpcCall, type AppApi } from "../../support/e2e";
import { sharedAdminApi, sharedAdminInBrowser } from "../admin-users/sharedAdmin";
import { actAs, makeCard, newBranch, type Staff } from "../support-links/helpers";

type Playwright = PlaywrightWorkerArgs["playwright"];
type Cookies = Awaited<ReturnType<AppApi["request"]["storageState"]>>["cookies"];
const SHOT = ".results/T-39";
const TEMP = "Temp-Pass-4471";
const OWN = "My-Own-Pass-2026!";
const width = (page: Page): string => String(page.viewportSize()?.width);
const uniq = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

// Happy answers: no alert is raised.
const ANSWERS = {
  Q1: 5,
  Q2: "Yes",
  Q3: "No",
  Q4: 5,
  Q5: "Yes",
  Q6: "Yes",
  Q7: "Yes",
  Q8: 5,
  Q9: "Yes",
  Q9a: "Quality of Service",
  Q10: "No",
};

interface Scene {
  branchName: string;
  advisorName: string;
  staff: Staff;
  bossCookies: Cookies;
}

/** A new branch with a branch admin, a uniquely named advisor, and `total` visits (`done` answered). */
async function scene(
  playwright: Playwright,
  base: string,
  label: string,
  total: number,
  done: number,
): Promise<Scene> {
  const { branchId, staff } = await newBranch(playwright, base, { label, name: "Priya" });
  const admin = await sharedAdminApi(playwright, base);
  const advisorName = `Adv${uniq()}`;
  await createAdvisor(admin, { branchId, name: advisorName });
  for (let i = 0; i < total; i++) {
    const card = await makeCard(staff);
    const out = await rpcCall<{ url: string }>(staff.api, "visits", "createVisitLink", [
      { jobCardId: card.id },
    ]);
    if (i >= done) continue;
    const code = new URL(out.url).pathname.replace("/f/", "");
    await rpcCall(staff.api, "feedback", "submitResponse", [code, ANSWERS]);
  }
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
  const branchName = (await listBranches(admin)).find((b) => b.id === branchId)?.name ?? "";
  return { branchName, advisorName, staff, bossCookies: (await request.storageState()).cookies };
}

const tile = (page: Page, label: string) =>
  page.locator(`[data-testid="kpi-tile"][data-label="${label}"]`);

async function openAs(page: Page, s: Scene, query = ""): Promise<void> {
  await page.context().clearCookies();
  await page.context().addCookies(s.bossCookies);
  await page.goto(`/admin${query}`);
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
}

test.describe("T-39 overview analytics on v2", () => {
  test("S-30 the branch admin sees their branch's rate; the main admin filters by branch", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const base = String(baseURL);
    const vel = await scene(playwright, base, "Velachery", 4, 3);
    const tam = await scene(playwright, base, "Tambaram", 2, 1);

    await openAs(page, vel);
    await expect(tile(page, "Response rate")).toContainText("75%");
    await expect(tile(page, "Responses")).toContainText("3");
    await expect(page.getByRole("combobox", { name: "Branch" })).toHaveCount(0);
    await page.getByRole("combobox", { name: "Advisor" }).click();
    await expect(page.getByRole("option", { name: vel.advisorName })).toBeVisible();
    await expect(page.getByRole("option", { name: tam.advisorName })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await page.screenshot({ path: `${SHOT}/branch-admin-${width(page)}.png` });

    await sharedAdminInBrowser(page, playwright, base);
    await page.goto("/admin");
    await expect(page.getByRole("combobox", { name: "Branch" })).toBeVisible();
    await page.getByRole("combobox", { name: "Branch" }).click();
    await page.getByRole("option", { name: tam.branchName, exact: true }).click();
    await expect(tile(page, "Response rate")).toContainText("50%");
    await expect(tile(page, "Responses")).toContainText("1");
    await page.getByRole("combobox", { name: "Advisor" }).click();
    await expect(page.getByRole("option", { name: tam.advisorName })).toBeVisible();
    await expect(page.getByRole("option", { name: vel.advisorName })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await page.screenshot({ path: `${SHOT}/main-admin-tambaram-${width(page)}.png` });

    await page.getByRole("combobox", { name: "Branch" }).click();
    await page.getByRole("option", { name: vel.branchName, exact: true }).click();
    await expect(tile(page, "Response rate")).toContainText("75%");
    await page.getByRole("combobox", { name: "Branch" }).click();
    await page.getByRole("option", { name: "All branches" }).click();
    await expect(page.getByRole("combobox", { name: "Branch" })).toContainText("All branches");
  });

  test("S-10 a launch-day branch with no responses shows dashes and no arrows", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const s = await scene(playwright, String(baseURL), "Launch", 0, 0);
    await openAs(page, s);
    await expect(page.getByText("No responses for these filters")).toBeVisible();
    for (const label of ["Responses", "Response rate", "Recommend rate", "Callbacks requested"]) {
      await expect(tile(page, label)).toContainText("—");
    }
    await expect(tile(page, "Avg overall satisfaction")).toContainText("—");
    await expect(page.getByTestId("delta")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Category scores" })).toHaveCount(0);
    await page.screenshot({ path: `${SHOT}/launch-day-${width(page)}.png` });
  });

  test("S-10 / T-39 a branch with 3 happy responses: v2 tiles, expandable categories, advisor score", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const s = await scene(playwright, String(baseURL), "Happy", 3, 3);
    await openAs(page, s);
    await expect(tile(page, "Avg overall satisfaction")).toContainText("5.0");
    await expect(tile(page, "Recommend rate")).toContainText("100%");
    await expect(tile(page, "Callbacks requested")).toContainText("0");
    await expect(page.getByTestId("category-row")).toHaveCount(5);
    await expect(page.getByTestId("category-score").first()).toContainText("100");
    await expect(page.getByTestId("category-question")).toHaveCount(0);
    await page.getByTestId("category-row").first().getByRole("button").click();
    await expect(page.getByTestId("category-question")).toHaveCount(3);
    await expect(page.getByTestId("follow-up").first()).toBeVisible();
    await expect(page.getByText("Rating 5").first()).toBeVisible();
    for (const gone of ["Problem breakdown", "Question detail", "Recent comments"]) {
      await expect(page.getByText(gone)).toHaveCount(0);
    }
    const score = page.getByTestId(
      page.viewportSize()?.width === 360 ? "advisor-card" : "advisor-row",
    );
    await expect(score.first()).toContainText("100");
    await expect(page.getByTestId("advisor-score").first()).toHaveText("100 /100");
    await page.screenshot({ path: `${SHOT}/overview-expanded-${width(page)}.png`, fullPage: true });
  });

  test("an advisor with under 3 responses has no score, only a dash", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const s = await scene(playwright, String(baseURL), "Few", 2, 2);
    await openAs(page, s);
    await expect(page.getByTestId("advisor-score").first()).toHaveText("—");
  });

  test("S-11 the date range follows the service date", async ({ page, playwright, baseURL }) => {
    const s = await scene(playwright, String(baseURL), "Dated", 2, 2);
    await openAs(page, s);
    await expect(tile(page, "Responses")).toContainText("2");
    // a range that ended before the cards' service date holds nothing, however recent the feedback
    await openAs(page, s, "?from=2020-01-01&to=2020-01-31");
    await expect(page.getByText("No responses for these filters")).toBeVisible();
    await expect(tile(page, "Responses")).toContainText("—");
  });

  test("AC-6 (G-W2) Support is refused: not allowed on /admin and FORBIDDEN from the API", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const s = await scene(playwright, String(baseURL), "Guarded", 0, 0);
    const res = await s.staff.api.request.post("/api/rpc/analytics/getAnalytics", {
      headers: { origin: s.staff.api.origin },
      data: { args: [{ from: "2026-01-01", to: "2026-12-31" }] },
    });
    expect(await res.json()).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    await actAs(page, s.staff);
    await page.goto("/admin");
    await expect(page.getByText("You don't have access to this page")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Overview" })).toHaveCount(0);
    await page.screenshot({ path: `${SHOT}/support-${width(page)}.png` });
  });
});
