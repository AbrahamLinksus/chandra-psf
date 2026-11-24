/* eslint-disable max-lines-per-function -- each test plays one scenario end to end */
import { expect, test, type Page } from "@playwright/test";
import { rpcCall } from "../../support/e2e";
import { actAs, adminOf, makeCard, newBranch, newStaff, SHOT, signInAgain } from "./helpers";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

const NEEDS_MOBILE = "Enter a mobile number to send on WhatsApp";
const width = (page: Page): string => String(page.viewportSize()?.width);
const shot = (page: Page, name: string) =>
  page.screenshot({ path: `${SHOT}/${name}-${width(page)}.png` });

async function lookup(page: Page, no: string): Promise<void> {
  await page.goto("/support/new");
  await expect(page.getByRole("heading", { name: "New feedback link" })).toBeVisible();
  await page.getByLabel("Job card number").first().fill(no);
  await page.getByRole("button", { name: "Look up" }).click();
}

test.describe("T-03c support: generate and send a link, My links / All branch links", () => {
  test("test_s01_generate_send_copy_then_reopen_shows_no_link (S-01, S-17)", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const { staff } = await newBranch(playwright, String(baseURL), {
      label: "Velachery",
      name: "Kavitha",
    });
    await actAs(page, staff);
    const { no } = await makeCard(staff);

    await lookup(page, no);
    await page.getByRole("button", { name: "Generate link" }).click();
    const url = (await page.getByTestId("link-url").textContent()) ?? "";
    expect(url).toMatch(/\/f\/[A-Za-z0-9_-]{43}$/);
    await expect(page.getByText("Created", { exact: true })).toBeVisible();
    await expect(page.getByText(/^Expires \d{1,2} [A-Z][a-z]{2} \d{4}$/)).toBeVisible();

    const text =
      `Hi Ramesh Kumar, thank you for servicing your Activa 6G (TN 09 BX 4521) at Chandra Honda. ` +
      `Please share your feedback (2 mins): ${url}`;
    const send = page.getByRole("link", { name: "Send on WhatsApp" });
    await expect(send).toHaveAttribute(
      "href",
      `https://wa.me/919840012345?text=${encodeURIComponent(text)}`,
    );
    await page.getByRole("button", { name: "Copy link" }).click();
    await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(url);
    await shot(page, "1-generated");

    // Leave and come back: status only, no link, no Copy (G-1, S-17); one current link, no duplicate.
    await lookup(page, no);
    await expect(page.getByText("Created", { exact: true })).toBeVisible();
    await expect(page.getByTestId("link-url")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Copy link|Copied/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Generate link" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Resend" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Regenerate" })).toBeVisible();
    await shot(page, "1b-reopened");

    // Resend hands back a fresh code to send or copy.
    await page.getByRole("button", { name: "Resend" }).click();
    const again = (await page.getByTestId("link-url").textContent()) ?? "";
    expect(again).toMatch(/\/f\/[A-Za-z0-9_-]{43}$/);
    expect(again).not.toBe(url);
    await expect(page.getByRole("link", { name: "Send on WhatsApp" })).toBeVisible();
  });

  test("test_s03_no_mobile_disables_send_but_copy_works (S-03)", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const { staff } = await newBranch(playwright, String(baseURL), {
      label: "Adyar",
      name: "Kavitha",
    });
    await actAs(page, staff);
    const { no } = await makeCard(staff, { phone: null });

    await lookup(page, no);
    await page.getByRole("button", { name: "Generate link" }).click();
    const url = (await page.getByTestId("link-url").textContent()) ?? "";
    await expect(page.getByRole("button", { name: "Send on WhatsApp" })).toBeDisabled();
    await expect(page.getByText(NEEDS_MOBILE)).toBeVisible();
    await page.getByRole("button", { name: "Copy link" }).click();
    await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(url);
    await shot(page, "2-no-mobile");
  });

  test("test_s19_my_links_all_branch_links_search_empty_and_branch_move (S-19, G-8)", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const base = String(baseURL);
    const {
      branchId,
      advisorId,
      staff: kavitha,
    } = await newBranch(playwright, base, { label: "Velachery", name: "Kavitha" });
    const meena = await newStaff(playwright, base, { branchId, advisorId, name: "Meena" });
    await actAs(page, kavitha);

    await page.goto("/support");
    await expect(page.getByText("No feedback links yet.")).toBeVisible();
    await expect(page.getByText("Tap New feedback link to start.")).toBeVisible();
    await shot(page, "3-empty");

    const mine = await makeCard(kavitha, { reg: "tn09bx4521" });
    const theirs = await makeCard(meena, { reg: "tn10ab1111" });
    await rpcCall(kavitha.api, "visits", "createVisitLink", [{ jobCardId: mine.id }]);
    await rpcCall(meena.api, "visits", "createVisitLink", [{ jobCardId: theirs.id }]);

    await page.goto("/support");
    await expect(page.getByText(mine.no)).toBeVisible();
    await expect(page.getByText(theirs.no)).toHaveCount(0);

    await page.getByLabel("All branch links").click();
    await expect(page.getByText(theirs.no)).toBeVisible();
    await expect(page.getByText("Created by Meena")).toBeVisible();
    await expect(page.getByText("Created by Kavitha")).toBeVisible();
    await expect(page.getByTestId("link-url")).toHaveCount(0);
    await expect(page.getByText(/answer|rating|★/i)).toHaveCount(0);
    await shot(page, "4-all-branch");

    const search = page.getByLabel("Search by job card or reg. no");
    await search.fill("TN 10 AB");
    await expect(page.getByText(theirs.no)).toBeVisible();
    await expect(page.getByText(mine.no)).toHaveCount(0);
    await search.fill(mine.no.toLowerCase());
    await expect(page.getByText(mine.no)).toBeVisible();
    await search.fill("zzz999");
    await expect(page.getByText("No links match your search")).toBeVisible();

    // Kavitha is moved to Tambaram: she sees only Tambaram's links (G-8).
    const other = await newBranch(playwright, base, { label: "Tambaram", name: "Latha" });
    const otherCard = await makeCard(other.staff);
    await rpcCall(other.staff.api, "visits", "createVisitLink", [{ jobCardId: otherCard.id }]);
    const admin = await adminOf(playwright, base);
    await rpcCall(admin, "users", "updateUser", [kavitha.userId, { branchId: other.branchId }]);
    const moved = await signInAgain(playwright, base, kavitha);
    await actAs(page, moved);
    await page.goto("/support");
    await page.getByLabel("All branch links").click();
    await expect(page.getByText(otherCard.no)).toBeVisible();
    await expect(page.getByText(mine.no)).toHaveCount(0);
    await expect(page.getByText(theirs.no)).toHaveCount(0);
  });
});
