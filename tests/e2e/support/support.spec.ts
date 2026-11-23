/* eslint-disable max-lines-per-function -- describe blocks group many one-line tests */
import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "../../support/e2e";

const NOT_FOUND = "Job card not found. Check the number on the job card.";
const NEEDS_MOBILE = "Enter a mobile number to send on WhatsApp";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

const width = (page: Page): string => String(page.viewportSize()?.width);

async function lookup(page: Page, no: string): Promise<void> {
  await page.getByLabel("Job card number").fill(no);
  await page.getByRole("button", { name: "Look up" }).click();
}

async function openNew(
  page: Page,
  who: "support1" | "support2" = "support1",
  q = "",
): Promise<void> {
  await signInAs(page, who);
  await page.goto(`/support/new${q}`);
  await expect(page.getByRole("heading", { name: "New feedback link" })).toBeVisible();
}

function expectedWa(number: string, url: string): string {
  const text =
    `Hi Ramesh Kumar, thank you for servicing your Activa 6G (TN 09 BX 4521) at Chandra Honda. ` +
    `Please share your feedback (2 mins): ${url}`;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

async function stored(page: Page, key: string): Promise<string> {
  return page.evaluate((k) => window.localStorage.getItem(k) ?? "", key);
}

// Phase-1 demo spec: it signs in through browser storage, which no longer exists. Rebuilt on the server by T-03b.
test.fixme(true, "rebuilt by T-03b");

test.describe("T-03 support: look up, send, manage links", () => {
  test("JC-24-1042 autofills the SPEC row (AC-1) and the hint lists fresh cards (S-07)", async ({
    page,
  }) => {
    await openNew(page);
    await expect(page.getByText(/Try: .*JC-24-1042/)).toBeVisible();
    await lookup(page, "JC-24-1042");
    const card = page.getByRole("region", { name: "Job card details" });
    for (const t of [
      "Ramesh Kumar",
      "TN 09 BX 4521",
      "Activa 6G",
      "Scooter",
      "Paid service",
      "Suresh",
    ]) {
      await expect(card.getByText(t, { exact: true })).toBeVisible();
    }
    await expect(card.getByText(/^\d{1,2} [A-Z][a-z]{2}/)).toBeVisible();
    await expect(page.getByLabel("Phone")).toHaveValue("+91 98400 12345");
    await page.screenshot({ path: `.results/T-03/lookup-${width(page)}.png` });
  });

  test("typed variants find the card (S-02)", async ({ page }) => {
    await openNew(page);
    for (const typed of [" jc241042", "JC 24 1042"]) {
      await lookup(page, typed);
      await expect(page.getByText("Ramesh Kumar", { exact: true })).toBeVisible();
    }
  });

  test("unknown number shows the message; empty input is blocked (G-01, G-05)", async ({
    page,
  }) => {
    await openNew(page);
    await lookup(page, "JC-99-0000");
    await expect(page.locator("p[role=alert]")).toHaveText(NOT_FOUND);
    await expect(page.getByRole("button", { name: "Generate link" })).toHaveCount(0);
    await lookup(page, "   ");
    await expect(page.locator("p[role=alert]")).toBeVisible();
    await expect(page.locator("p[role=alert]")).not.toHaveText(NOT_FOUND);
    await expect(page.getByRole("button", { name: "Generate link" })).toHaveCount(0);
  });

  test("s01 happy path: Created, 7 days, SPEC wa.me URL, Copied (S-01, AC-2)", async ({ page }) => {
    await openNew(page);
    await lookup(page, "JC-24-1042");
    await page.getByRole("button", { name: "Generate link" }).click();
    const url = (await page.getByTestId("link-url").textContent()) ?? "";
    expect(url).toMatch(new RegExp(`^${new URL(page.url()).origin}/f/[^/\\s]+$`)); // APP_URL empty: links use the page origin
    await expect(page.getByText("Created", { exact: true })).toBeVisible();
    await expect(page.getByText(/^Expires /)).toBeVisible();
    const send = page.getByRole("link", { name: "Send on WhatsApp" });
    await expect(send).toHaveAttribute("href", expectedWa("919840012345", url));
    await expect(send).toHaveAttribute("target", "_blank");
    await page.getByRole("button", { name: "Copy link" }).click();
    await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(url);
    await page.screenshot({ path: `.results/T-03/generated-${width(page)}.png` });
    // the link path resolves in the app (the form itself is a later task)
    const res = await page.goto(new URL(url).pathname);
    expect(res?.status()).toBe(200);
  });

  test("s03 landline: Send disabled with hint, Copy still works (S-03)", async ({ page }) => {
    await openNew(page);
    await lookup(page, "JC-24-1042");
    const phone = page.getByLabel("Phone");
    await phone.fill("");
    await expect(page.getByText(NEEDS_MOBILE)).toBeVisible();
    await phone.fill("044 2345 6789");
    await expect(page.getByText(NEEDS_MOBILE)).toBeVisible();
    await page.getByRole("button", { name: "Generate link" }).click();
    await expect(page.getByRole("button", { name: "Send on WhatsApp" })).toBeDisabled();
    await expect(page.getByText(NEEDS_MOBILE)).toBeVisible();
    await page.getByRole("button", { name: "Copy link" }).click();
    await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
    await page.screenshot({ path: `.results/T-03/landline-${width(page)}.png` });
  });

  test("s03 an edited mobile number goes into wa.me and is saved on the visit (S-03)", async ({
    page,
  }) => {
    await openNew(page);
    await lookup(page, "JC-24-1042");
    await page.getByLabel("Phone").fill("98765 43210");
    await page.getByRole("button", { name: "Generate link" }).click();
    const url = (await page.getByTestId("link-url").textContent()) ?? "";
    await expect(page.getByRole("link", { name: "Send on WhatsApp" })).toHaveAttribute(
      "href",
      expectedWa("919876543210", url),
    );
    const visits = JSON.parse(await stored(page, "psf:v1:visits")) as {
      jobCardNo: string;
      phone: string;
    }[];
    expect(visits.find((x) => x.jobCardNo === "JC-24-1042")?.phone).toBe("98765 43210");
  });

  test("an existing link shows its status instead of a duplicate; Completed says Feedback already received", async ({
    page,
  }) => {
    await openNew(page);
    await lookup(page, "JC-24-1034");
    await expect(page.getByText("Expired", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Regenerate" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel link" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Generate link" })).toHaveCount(0);
    await lookup(page, "JC-24-1002");
    await expect(page.getByText("Feedback already received")).toBeVisible();
    await expect(page.getByRole("button", { name: "Regenerate" })).toHaveCount(0);
  });

  test("/support lists only my links with badges, search works, no ratings (G-W2)", async ({
    page,
  }) => {
    await signInAs(page, "support1");
    await page.goto("/support");
    await expect(page.getByRole("heading", { name: "My feedback links" })).toBeVisible();
    await expect(page.getByText("JC-24-1034").first()).toBeVisible();
    await expect(page.getByText("JC-24-1035")).toHaveCount(0);
    await expect(page.getByText("Created", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/rating|answer/i)).toHaveCount(0);
    await page.getByLabel("Search by job card or reg. no").fill("jc 24 1034");
    await expect(page.getByText("JC-24-1034").first()).toBeVisible();
    await expect(page.getByText("JC-24-1036")).toHaveCount(0);
    await page.getByLabel("Search by job card or reg. no").fill("zzzz");
    await expect(page.getByText("No links match your search")).toBeVisible();
    await page.getByLabel("Search by job card or reg. no").fill("");
    await page.screenshot({ path: `.results/T-03/my-links-${width(page)}.png` });
  });

  test("Support 2 never sees Support 1's links (G-W2)", async ({ page }) => {
    await signInAs(page, "support2");
    await page.goto("/support");
    await expect(page.getByText("JC-24-1035").first()).toBeVisible();
    await expect(page.getByText("JC-24-1034")).toHaveCount(0);
  });

  test("s05 Regenerate replaces the link; Resend reopens WhatsApp with the current link (S-05)", async ({
    page,
  }) => {
    await openNew(page);
    await lookup(page, "JC-24-1042");
    await page.getByRole("button", { name: "Generate link" }).click();
    const first = (await page.getByTestId("link-url").textContent()) ?? "";
    await page.getByRole("button", { name: "Regenerate" }).click();
    await expect(page.getByTestId("link-url")).not.toHaveText(first);
    const second = (await page.getByTestId("link-url").textContent()) ?? "";
    expect(await stored(page, "psf:v1:audit")).toContain("link.regenerate");
    await page.goto("/support");
    const row = page.getByRole("listitem").filter({ hasText: "JC-24-1042" });
    await expect(row).toHaveCount(1);
    await expect(row.getByTestId("link-url")).toHaveText(second);
    await expect(row.getByRole("link", { name: "Resend" })).toHaveAttribute(
      "href",
      expectedWa("919840012345", second),
    );
  });

  test("s14 Cancel (confirm) makes the link Cancelled and audits link.cancel (S-14)", async ({
    page,
  }) => {
    await signInAs(page, "support1");
    await page.goto("/support");
    const row = page.getByRole("listitem").filter({ hasText: "JC-24-1034" });
    await row.getByRole("button", { name: "Cancel link" }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.getByRole("alertdialog").getByRole("button", { name: "Cancel link" }).click();
    await expect(row.getByText("Cancelled", { exact: true })).toBeVisible();
    await expect(row.getByRole("button", { name: "Regenerate" })).toHaveCount(0);
    await expect(row.getByRole("button", { name: "Copy link" })).toHaveCount(0);
    await expect(row.getByRole("link", { name: "Send on WhatsApp" })).toHaveCount(0);
    await expect(row.getByRole("link", { name: "Resend" })).toHaveCount(0);
    expect(await stored(page, "psf:v1:audit")).toContain("link.cancel");
  });

  test("another user's link shows a note and no actions (isMine)", async ({ page }) => {
    await openNew(page, "support1");
    await lookup(page, "JC-24-1035");
    await expect(page.getByText("This link was sent by another team member")).toBeVisible();
    await expect(page.getByRole("button", { name: "Regenerate" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Cancel link" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Copy link" })).toHaveCount(0);
    await page.screenshot({ path: `.results/T-03/other-user-${width(page)}.png` });
  });

  test("a clipboard failure shows Couldn't copy", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: () => Promise.reject(new Error("denied")) },
        configurable: true,
      });
    });
    await openNew(page);
    await lookup(page, "JC-24-1042");
    await page.getByRole("button", { name: "Generate link" }).click();
    await page.getByRole("button", { name: "Copy link" }).click();
    await expect(page.getByRole("button", { name: "Couldn't copy" })).toBeVisible();
  });

  test("s13 a failed save shows 'Couldn't save, try again', keeps the phone, retry works (S-13)", async ({
    page,
  }) => {
    await openNew(page, "support1", "?demoFail=1");
    await lookup(page, "JC-24-1042");
    await page.getByLabel("Phone").fill("98765 43210");
    await page.getByRole("button", { name: "Generate link" }).click();
    await expect(page.getByText("Couldn't save, try again")).toBeVisible();
    await expect(page.getByLabel("Phone")).toHaveValue("98765 43210");
    await page.screenshot({ path: `.results/T-03/save-failed-${width(page)}.png` });
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByText("Created", { exact: true })).toBeVisible();
    await expect(page.getByTestId("link-url")).toBeVisible();
  });
});
