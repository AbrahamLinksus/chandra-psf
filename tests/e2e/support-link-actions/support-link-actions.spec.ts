/* eslint-disable max-lines-per-function -- each test plays one scenario end to end */
import { expect, test, type Page } from "@playwright/test";
import { rpcCall } from "../../support/e2e";
import { actAs, makeCard, newBranch, newStaff } from "../support-links/helpers";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

const SHOT = ".results/T-03d";
const width = (page: Page): string => String(page.viewportSize()?.width);
const shot = (page: Page, name: string) =>
  page.screenshot({ path: `${SHOT}/${name}-${width(page)}.png` });

interface Issued {
  url: string;
  visit: { id: string };
}

/** Velachery with Priya (and Arun), a card, and a link Priya made through the API. */
async function scene(playwright: Parameters<typeof newBranch>[0], base: string) {
  const {
    branchId,
    advisorId,
    staff: priya,
  } = await newBranch(playwright, base, {
    label: "Velachery",
    name: "Priya",
  });
  const arun = await newStaff(playwright, base, { branchId, advisorId, name: "Arun" });
  const card = await makeCard(priya);
  const issued = await rpcCall<Issued>(priya.api, "visits", "createVisitLink", [
    { jobCardId: card.id },
  ]);
  return { branchId, advisorId, priya, arun, card, issued };
}

/** The link card for a job card number on the Support list. */
const cardOf = (page: Page, no: string) => page.getByRole("listitem").filter({ hasText: no });

async function expiryOf(page: Page, no: string): Promise<string> {
  return (
    (await cardOf(page, no)
      .getByText(/^Expires /)
      .textContent()) ?? ""
  );
}

test.describe("T-03d support: resend, regenerate and cancel", () => {
  test("test_resend_from_my_links_gives_new_code_whatsapp_copy_same_expiry (G-1, S-17)", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const { priya, card, issued } = await scene(playwright, String(baseURL));
    await actAs(page, priya);
    await page.goto("/support");
    const row = cardOf(page, card.no);
    const expiry = await expiryOf(page, card.no);
    await expect(row.getByTestId("link-url")).toHaveCount(0);

    await row.getByRole("button", { name: "Resend" }).click();
    const url = (await row.getByTestId("link-url").textContent()) ?? "";
    expect(url).toMatch(/\/f\/[A-Za-z0-9_-]{43}$/);
    expect(url).not.toBe(issued.url);
    await expect(row.getByRole("link", { name: "Send on WhatsApp" })).toHaveAttribute(
      "href",
      new RegExp(`^https://wa\\.me/919840012345\\?text=.*${encodeURIComponent(url).slice(-20)}`),
    );
    await row.getByRole("button", { name: "Copy link" }).click();
    await expect(row.getByRole("button", { name: "Copied" })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(url);
    expect(await expiryOf(page, card.no)).toBe(expiry);
    await shot(page, "1-resent");
  });

  test("test_arun_resends_a_link_priya_made_from_all_branch_links (G-8)", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const { arun, card, issued } = await scene(playwright, String(baseURL));
    await actAs(page, arun);
    await page.goto("/support");
    await expect(page.getByText(card.no)).toHaveCount(0);
    await page.getByLabel("All branch links").click();
    const row = cardOf(page, card.no);
    await expect(row.getByText("Created by Priya")).toBeVisible();
    await row.getByRole("button", { name: "Resend" }).click();
    const url = (await row.getByTestId("link-url").textContent()) ?? "";
    expect(url).not.toBe(issued.url);
    await shot(page, "2-arun-resend");
    // The audit actor (Arun) is asserted in tests/unit/server/visits-actions; listAudit is not served yet.
  });

  test("test_regenerate_gives_a_new_visit_with_a_fresh_code (S-05)", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const { priya, card, issued } = await scene(playwright, String(baseURL));
    await actAs(page, priya);
    await page.goto("/support");
    const row = cardOf(page, card.no);
    await row.getByRole("button", { name: "Regenerate" }).click();
    const url = (await row.getByTestId("link-url").textContent()) ?? "";
    expect(url).toMatch(/\/f\/[A-Za-z0-9_-]{43}$/);
    expect(url).not.toBe(issued.url);
    await expect(row.getByRole("link", { name: "Send on WhatsApp" })).toBeVisible();
    await expect(row.getByText("Created", { exact: true })).toBeVisible();
    const list = await rpcCall<{ id: string }[]>(priya.api, "visits", "listVisits", [
      { scope: "mine" },
    ]);
    expect(list).toHaveLength(1);
    expect(list[0]?.id).not.toBe(issued.visit.id);
    await shot(page, "3-regenerated");
  });

  test("test_cancel_asks_to_confirm_then_shows_cancelled (S-14)", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const { priya, card } = await scene(playwright, String(baseURL));
    await actAs(page, priya);
    await page.goto("/support");
    const row = cardOf(page, card.no);
    await row.getByRole("button", { name: "Cancel link" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog.getByText("Cancel this link?")).toBeVisible();
    await shot(page, "4-confirm");

    // Backing out changes nothing.
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(row.getByText("Created", { exact: true })).toBeVisible();

    await row.getByRole("button", { name: "Cancel link" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Cancel link" }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(row.getByText("Cancelled", { exact: true })).toBeVisible();
    await expect(row.getByRole("button", { name: /Resend|Regenerate|Cancel link/ })).toHaveCount(0);
    await shot(page, "5-cancelled");

    await page.reload();
    await expect(cardOf(page, card.no).getByText("Cancelled", { exact: true })).toBeVisible();
  });

  test("test_actions_on_a_cancelled_link_from_a_stale_screen_say_cannot_be_changed", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const { priya, arun, card, issued } = await scene(playwright, String(baseURL));
    await actAs(page, priya);
    await page.goto("/support");
    const row = cardOf(page, card.no);
    await expect(row.getByRole("button", { name: "Resend" })).toBeVisible();
    // Arun cancels behind Priya's open screen.
    await rpcCall(arun.api, "visits", "cancelLink", [issued.visit.id]);
    await row.getByRole("button", { name: "Resend" }).click();
    await expect(row.getByText("This link can no longer be changed")).toBeVisible();
    await shot(page, "6-cannot-change");
  });

  test("test_failed_save_shows_couldnt_save_and_retry_reruns_the_same_action (S-13)", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const { priya, card } = await scene(playwright, String(baseURL));
    await actAs(page, priya);
    await page.goto("/support");
    const row = cardOf(page, card.no);
    await page.route("**/api/rpc/visits/resendLink", (route) => route.abort("failed"));
    await row.getByRole("button", { name: "Resend" }).click();
    await expect(row.getByText("Couldn't save, try again")).toBeVisible();
    await shot(page, "7-failed-save");

    await page.unroute("**/api/rpc/visits/resendLink");
    await row.getByRole("button", { name: "Retry" }).click();
    await expect(row.getByTestId("link-url")).toBeVisible();
    await expect(row.getByText("Couldn't save, try again")).toHaveCount(0);
  });

  test("test_retry_after_a_failed_cancel_cancels (S-13)", async ({ page, playwright, baseURL }) => {
    const { priya, card } = await scene(playwright, String(baseURL));
    await actAs(page, priya);
    await page.goto("/support");
    const row = cardOf(page, card.no);
    await page.route("**/api/rpc/visits/cancelLink", (route) => route.abort("failed"));
    await row.getByRole("button", { name: "Cancel link" }).click();
    const dialog = page.getByRole("alertdialog");
    await dialog.getByRole("button", { name: "Cancel link" }).click();
    await expect(dialog.getByText("Couldn't save, try again")).toBeVisible();

    await page.unroute("**/api/rpc/visits/cancelLink");
    await dialog.getByRole("button", { name: "Retry" }).click();
    await expect(row.getByText("Cancelled", { exact: true })).toBeVisible();
  });

  test("test_another_branchs_visit_id_is_not_found_over_the_api (US-29)", async ({
    playwright,
    baseURL,
  }) => {
    const base = String(baseURL);
    const { issued } = await scene(playwright, base);
    const other = await newBranch(playwright, base, { label: "Tambaram", name: "Latha" });
    for (const method of ["resendLink", "regenerateLink", "cancelLink"]) {
      await expect(rpcCall(other.staff.api, "visits", method, [issued.visit.id])).rejects.toThrow(
        /NOT_FOUND/,
      );
    }
  });

  test("test_the_api_refuses_resend_on_a_completed_or_cancelled_link (S-13)", async ({
    playwright,
    baseURL,
  }) => {
    const { priya, issued } = await scene(playwright, String(baseURL));
    await rpcCall(priya.api, "visits", "cancelLink", [issued.visit.id]);
    for (const method of ["resendLink", "regenerateLink", "cancelLink"]) {
      await expect(rpcCall(priya.api, "visits", method, [issued.visit.id])).rejects.toThrow(
        /CONFLICT This link can no longer be changed/,
      );
    }
  });
});

test.describe("T-03d customer pages for an old code", () => {
  // needs T-04b: the customer pages in src/app/f/** are not built yet.
  test.fixme("test_old_code_after_resend_shows_a_newer_link_was_sent (S-17)", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const { priya, issued } = await scene(playwright, String(baseURL));
    await rpcCall<Issued>(priya.api, "visits", "resendLink", [issued.visit.id]);
    await page.goto(issued.url);
    await expect(page.getByText("A newer link was sent to you on WhatsApp")).toBeVisible();
  });

  // needs T-04b
  test.fixme("test_old_code_after_regenerate_shows_the_newer_link_page (S-05)", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const { priya, issued } = await scene(playwright, String(baseURL));
    await rpcCall<Issued>(priya.api, "visits", "regenerateLink", [issued.visit.id]);
    await page.goto(issued.url);
    await expect(page.getByText("A newer link was sent to you on WhatsApp")).toBeVisible();
  });

  // needs T-04b
  test.fixme("test_cancelled_link_shows_link_not_valid (S-14)", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const { priya, issued } = await scene(playwright, String(baseURL));
    await rpcCall(priya.api, "visits", "cancelLink", [issued.visit.id]);
    await page.goto(issued.url);
    await expect(page.getByText("Link not valid")).toBeVisible();
  });
});
