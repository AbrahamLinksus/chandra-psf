/* eslint-disable max-lines-per-function -- each test plays one scenario end to end */
import {
  expect,
  test,
  type APIRequestContext,
  type Page,
  type PlaywrightWorkerArgs,
} from "@playwright/test";
import { createAdvisor, createBranch, createSupportUser, rpcCall } from "../../support/e2e";
import { sharedAdminApi } from "../admin-users/sharedAdmin";

const TEMP = "Temp-Pass-4471";
const OWN = "My-Own-Pass-2026!";
const SHOT = ".results/T-03b";

interface Staff {
  branchId: string;
  branchName: string;
  advisorId: string;
  cookies: Awaited<ReturnType<APIRequestContext["storageState"]>>["cookies"];
}

/** One branch and support user per project and label: fewer new staff while other specs list users. */
const staffCache = new Map<string, Staff>();

const stamp = (page: Page): string =>
  `${String(page.viewportSize()?.width)}.${String(Date.now())}.${Math.random().toString(36).slice(2, 6)}`;

/** A fresh branch with advisor Suresh (unless none wanted) and a signed-in support user. */
async function branchWithSupport(
  page: Page,
  playwright: PlaywrightWorkerArgs["playwright"],
  base: string,
  o: { label: string; advisor?: boolean },
): Promise<Staff> {
  const key = `${test.info().project.name}:${o.label}`;
  const cached = staffCache.get(key);
  if (cached) {
    await page.context().addCookies(cached.cookies);
    return cached;
  }
  const admin = await sharedAdminApi(playwright, base);
  const tag = stamp(page);
  const branchName = `${o.label} ${tag}`;
  const { id: branchId } = await createBranch(admin, { name: branchName, city: "Chennai" });
  let advisorId = "";
  if (o.advisor !== false) {
    advisorId = (await createAdvisor(admin, { branchId, name: "Suresh" })).id;
  }
  const email = `aide.${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@chandrahonda.in`;
  await createSupportUser(admin, { name: "Kavitha", email, tempPassword: TEMP, branchId });
  const request = await playwright.request.newContext({ baseURL: base });
  const api = { request, origin: new URL(base).origin };
  await rpcCall(api, "auth", "signIn", [email, TEMP]);
  await rpcCall(api, "auth", "setOwnPassword", [OWN]);
  const cookies = (await request.storageState()).cookies;
  await request.dispose();
  await page.context().addCookies(cookies);
  const staff = { branchId, branchName, advisorId, cookies };
  staffCache.set(key, staff);
  return staff;
}

async function openNew(page: Page): Promise<void> {
  await page.goto("/support/new");
  await expect(page.getByRole("heading", { name: "New feedback link" })).toBeVisible();
}

async function lookup(page: Page, no: string): Promise<void> {
  await page.getByLabel("Job card number").first().fill(no);
  await page.getByRole("button", { name: "Look up" }).click();
}

const isoPlusDays = (n: number): string =>
  new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

/** Fills the New job card form with the SPEC §5 row (service date left at today). */
async function fillRamesh(page: Page, o: { phone?: string; date?: string } = {}): Promise<void> {
  const form = page.locator("form").filter({ hasText: "Save job card" });
  await form.getByLabel("Customer name").fill("Ramesh Kumar");
  await form.getByLabel("Mobile (optional)").fill(o.phone ?? "98400 12345");
  await form.getByLabel("Reg. no.").fill("tn09bx4521");
  await form.getByLabel("Model", { exact: true }).selectOption("Activa");
  await form.getByLabel("Service type").selectOption("Paid service");
  if (o.date !== undefined) await form.getByLabel("Service date").fill(o.date);
  await form.getByLabel("Advisor").selectOption({ label: "Suresh" });
}

const save = (page: Page) => page.getByRole("button", { name: "Save job card" }).click();
const shot = (page: Page, name: string) =>
  page.screenshot({ path: `${SHOT}/${name}-${String(page.viewportSize()?.width)}.png` });

test.describe("T-03b support: find a job card or type in a new one", () => {
  test("test_s02_typed_number_not_found_then_new_card_saves_and_is_found (S-02)", async ({
    page,
    playwright,
    baseURL,
  }) => {
    await branchWithSupport(page, playwright, String(baseURL), { label: "Velachery" });
    await openNew(page);
    await shot(page, "1-lookup");

    await lookup(page, " JC-24-1042");
    const missing = page.getByRole("alert").filter({ hasText: "at this branch yet" });
    await expect(missing).toContainText("No job card JC-24-1042 at this branch yet");
    await shot(page, "2-not-found");

    await missing.getByRole("button", { name: "New job card" }).click();
    await expect(page.getByLabel("Job card number").last()).toHaveValue("JC-24-1042");
    await fillRamesh(page);
    await shot(page, "3-form");
    await save(page);
    const summary = page.getByTestId("card-summary");
    await expect(summary).toHaveText("+91 98400 12345 · TN 09 BX 4521 · Scooter · Advisor: Suresh");
    const card = page.getByRole("region", { name: "Job card details" });
    await expect(card).toContainText("Ramesh Kumar");
    await expect(card).toContainText("Activa · Paid service");
    await shot(page, "4-found-after-save");

    await openNew(page);
    await lookup(page, " jc241042");
    await expect(page.getByTestId("card-summary")).toHaveText(
      "+91 98400 12345 · TN 09 BX 4521 · Scooter · Advisor: Suresh",
    );
    await shot(page, "5-found-by-typed-number");
  });

  test("test_us29_another_branch_cannot_see_the_card (S-29)", async ({
    page,
    playwright,
    baseURL,
  }) => {
    await branchWithSupport(page, playwright, String(baseURL), { label: "Velachery" });
    await openNew(page);
    await lookup(page, "JC-24-2001");
    await page.getByRole("button", { name: "New job card" }).click();
    await fillRamesh(page);
    await save(page);
    await expect(page.getByTestId("card-summary")).toBeVisible();

    await page.context().clearCookies();

    // A second branch's support user never sees it (US-29) and may add its own.
    await branchWithSupport(page, playwright, String(baseURL), { label: "Tambaram" });
    await openNew(page);
    await lookup(page, "JC-24-2001");
    await expect(page.getByRole("alert").filter({ hasText: "at this branch yet" })).toContainText(
      "No job card JC-24-2001 at this branch yet",
    );
  });

  test("test_s29_duplicate_number_shows_already_exists_with_open_it (S-29)", async ({
    page,
    playwright,
    baseURL,
  }) => {
    await branchWithSupport(page, playwright, String(baseURL), { label: "Velachery" });
    await openNew(page);
    await lookup(page, "JC-24-2002");
    await page.getByRole("button", { name: "New job card" }).click();
    await fillRamesh(page);
    await save(page);
    await expect(page.getByTestId("card-summary")).toBeVisible();

    // A colleague's duplicate form: open the form for the same number straight away.
    await page.route("**/api/rpc/jobCards/getJobCard", (r) =>
      r.fulfill({
        json: {
          ok: false,
          error: { code: "NOT_FOUND", message: "No job card JC-24-2002 at this branch yet" },
        },
      }),
    );
    await lookup(page, "JC-24-2002");
    await page.getByRole("button", { name: "New job card" }).click();
    await page.unroute("**/api/rpc/jobCards/getJobCard");
    await fillRamesh(page);
    await save(page);
    const exists = page.getByRole("alert").filter({ hasText: "already exists" });
    await expect(exists).toContainText("JC-24-2002 already exists at this branch");
    await shot(page, "6-already-exists");
    await exists.getByRole("button", { name: "Open it" }).click();
    await expect(page.getByTestId("card-summary")).toHaveText(
      "+91 98400 12345 · TN 09 BX 4521 · Scooter · Advisor: Suresh",
    );
  });

  test("test_s29_lost_reply_then_retry_returns_the_saved_card_once (S-29, G-15)", async ({
    page,
    playwright,
    baseURL,
  }) => {
    await branchWithSupport(page, playwright, String(baseURL), { label: "Velachery" });
    await openNew(page);
    await lookup(page, "JC-24-2003");
    await page.getByRole("button", { name: "New job card" }).click();
    await fillRamesh(page);

    let first = true;
    await page.route("**/api/rpc/jobCards/createJobCard", async (route) => {
      if (first) {
        first = false;
        await route.fetch(); // the server stores the card...
        await route.abort("connectionreset"); // ...but the reply is lost
        return;
      }
      await route.continue();
    });
    await save(page);
    await expect(
      page.getByRole("alert").filter({ hasText: "Couldn't save, try again" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByTestId("card-summary")).toHaveText(
      "+91 98400 12345 · TN 09 BX 4521 · Scooter · Advisor: Suresh",
    );
    await expect(page.getByText("already exists at this branch")).toHaveCount(0);
  });

  test("test_s13_failed_save_keeps_the_form_and_says_couldnt_save (S-13)", async ({
    page,
    playwright,
    baseURL,
  }) => {
    await branchWithSupport(page, playwright, String(baseURL), { label: "Velachery" });
    await openNew(page);
    await lookup(page, "JC-24-2004");
    await page.getByRole("button", { name: "New job card" }).click();
    await fillRamesh(page);
    await page.route("**/api/rpc/jobCards/createJobCard", (r) => r.abort("connectionreset"));
    await save(page);
    await expect(
      page.getByRole("alert").filter({ hasText: "Couldn't save, try again" }),
    ).toBeVisible();
    await expect(page.getByLabel("Customer name")).toHaveValue("Ramesh Kumar");
    await expect(page.getByLabel("Reg. no.")).toHaveValue("tn09bx4521");
    await shot(page, "7-couldnt-save");
  });

  test("test_s03_future_date_is_refused_under_the_date_field (S-03)", async ({
    page,
    playwright,
    baseURL,
  }) => {
    await branchWithSupport(page, playwright, String(baseURL), { label: "Velachery" });
    await openNew(page);
    await lookup(page, "JC-24-2005");
    await page.getByRole("button", { name: "New job card" }).click();
    await fillRamesh(page, { date: isoPlusDays(3) });
    await save(page);
    await expect(page.getByText("Service date can't be in the future")).toBeVisible();
    await expect(page.getByLabel("Customer name")).toHaveValue("Ramesh Kumar");
  });

  test("test_s03_branch_without_advisors_says_ask_your_admin (S-03)", async ({
    page,
    playwright,
    baseURL,
  }) => {
    await branchWithSupport(page, playwright, String(baseURL), {
      label: "NoAdvisors",
      advisor: false,
    });
    await openNew(page);
    await lookup(page, "JC-24-2005");
    await page.getByRole("button", { name: "New job card" }).click();
    await expect(page.getByText("Ask your admin to add advisors for this branch")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save job card" })).toBeDisabled();
    await shot(page, "8-no-advisors");
  });

  test("test_s03_card_without_a_mobile_asks_for_one_and_a_phone_fix_is_kept (S-03)", async ({
    page,
    playwright,
    baseURL,
  }) => {
    await branchWithSupport(page, playwright, String(baseURL), { label: "Velachery" });
    await openNew(page);
    await lookup(page, "JC-24-1081");
    await page.getByRole("button", { name: "New job card" }).click();
    await fillRamesh(page, { phone: "" });
    await save(page);
    await expect(page.getByTestId("card-summary")).toContainText("No mobile");
    await expect(page.getByText("Enter a mobile number to send on WhatsApp")).toBeVisible();

    // Fixing the phone is a saved, audited edit (jobcard.update) through the same API.
    const card = await rpcCall<{ jobCard: { id: string } }>(
      { request: page.request, origin: new URL(String(baseURL)).origin },
      "jobCards",
      "getJobCard",
      ["JC-24-1081"],
    );
    await rpcCall(
      { request: page.request, origin: new URL(String(baseURL)).origin },
      "jobCards",
      "updateJobCard",
      [card.jobCard.id, { phone: "98400 12345" }],
    );
    await openNew(page);
    await lookup(page, "JC-24-1081");
    await expect(page.getByTestId("card-summary")).toContainText("+91 98400 12345");
  });
});
