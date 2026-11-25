/* eslint-disable max-lines-per-function -- one test walks the whole form */
import { expect, test, type Page } from "@playwright/test";
import { rpcCall } from "../../support/e2e";
import { makeCard, newBranch } from "../support-links/helpers";

const q = (page: Page, code: string) => page.locator(`[data-question="${code}"]`);
const rate = (page: Page, code: string, name: RegExp) =>
  q(page, code).getByRole("button", { name });
const chip = (page: Page, code: string, name: string) =>
  q(page, code).getByRole("button", { name, exact: true });
const next = (page: Page) => page.getByRole("button", { name: "Next", exact: true });
const submit = (page: Page) => page.getByRole("button", { name: "Submit", exact: true });

test.describe("T-38 questionnaire v2 form", () => {
  test("v2 form: 6 titled steps, no comments box, follow-ups open and close as SPEC F-3 says (AC-1, AC-2)", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const { staff } = await newBranch(playwright, String(baseURL), {
      label: "Velachery",
      name: "Kavitha",
    });
    const card = await makeCard(staff);
    const out = await rpcCall<{ url: string }>(staff.api, "visits", "createVisitLink", [
      { jobCardId: card.id },
    ]);
    await page.goto(new URL(out.url).pathname);
    await page.getByRole("button", { name: "Start" }).click();
    await expect(page.getByText("Step 1 of 6")).toBeVisible();
    await expect(page.getByText("Service Quality & Complaint Resolution")).toBeVisible();
    await expect(page.locator("[data-question]")).toHaveCount(3);
    await expect(next(page)).toBeDisabled();

    await rate(page, "Q1", /^2 /).click();
    await expect(q(page, "Q1a")).toBeVisible();
    await rate(page, "Q1", /^3 /).click();
    await expect(q(page, "Q1a")).toHaveCount(0);
    await chip(page, "Q3", "Yes").click();
    await expect(q(page, "Q3a")).toBeVisible();
    await chip(page, "Q3", "No").click();
    await expect(q(page, "Q3a")).toHaveCount(0);

    await chip(page, "Q2", "Partially").click();
    await expect(q(page, "Q2a")).toBeVisible();
    await expect(next(page)).toBeDisabled();
    await q(page, "Q2a").getByRole("textbox").fill("Brake noise still there");
    await expect(next(page)).toBeEnabled();
    await next(page).click();

    await expect(page.getByText("Step 2 of 6")).toBeVisible();
    await expect(page.getByText("Customer Interaction & Communication")).toBeVisible();
    await rate(page, "Q4", /^5 /).click();
    await next(page).click();
    await expect(page.getByText("Timelines & Vehicle Delivery")).toBeVisible();
    await chip(page, "Q5", "No").click();
    await expect(q(page, "Q5a")).toBeVisible();
    await chip(page, "Q5", "Yes").click();
    await expect(q(page, "Q5a")).toHaveCount(0);
    await chip(page, "Q6", "Yes").click();
    await next(page).click();
    await expect(page.getByText("Pricing & Value for Money")).toBeVisible();
    await chip(page, "Q7", "Yes").click();
    await rate(page, "Q8", /^5 /).click();
    await next(page).click();
    await expect(page.getByText("Overall Satisfaction & Loyalty")).toBeVisible();
    await chip(page, "Q9", "No").click();
    await expect(q(page, "Q9a")).toBeVisible();
    await chip(page, "Q9", "Yes").click();
    await expect(q(page, "Q9a")).toBeVisible();
    await chip(page, "Q9a", "Staff Behaviour").click();
    await next(page).click();
    await expect(page.getByText("Step 6 of 6")).toBeVisible();
    await expect(page.getByText(/additional feedback/i)).toHaveCount(0);
    await chip(page, "Q10", "Yes").click();
    await expect(q(page, "Q10a")).toBeVisible();
    await expect(submit(page)).toBeDisabled();
    await chip(page, "Q10", "No").click();
    await expect(q(page, "Q10a")).toHaveCount(0);
    await expect(submit(page)).toBeEnabled();
  });
});
