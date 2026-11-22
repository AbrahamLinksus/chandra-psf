/* eslint-disable max-lines-per-function -- one screenshot tour per role */
import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "../../support/e2e";
import { fillUntilCallback, makeToken, shot, stored } from "./helpers";

/** Every visible form control must have an accessible name (G-W5). */
async function expectLabelled(page: Page, where: string): Promise<void> {
  const unnamed = await page.evaluate(() => {
    const sel = "input:not([type=hidden]), textarea, select, [role=combobox], [role=switch]";
    const bad: string[] = [];
    const hasName = (el: HTMLElement): boolean =>
      ((el as HTMLInputElement).labels?.length ?? 0) > 0 ||
      (el.getAttribute("aria-label") ?? "").trim() !== "" ||
      (el.getAttribute("aria-labelledby") ?? "")
        .split(/\s+/)
        .some((id) => (document.getElementById(id)?.textContent ?? "").trim() !== "");
    const shown = (el: HTMLElement): boolean =>
      el.offsetParent !== null || getComputedStyle(el).position === "fixed";
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
      if (shown(el) && !hasName(el)) bad.push(el.outerHTML.slice(0, 120));
    }
    return bad;
  });
  expect(unnamed, `unlabelled controls on ${where}`).toEqual([]);
}

async function visit(page: Page, url: string, ready: RegExp | string, name: string): Promise<void> {
  await page.goto(url);
  await expect(page.getByRole("heading", { name: ready }).first()).toBeVisible();
  await expectLabelled(page, url);
  await shot(page, name);
}

test.describe("T-11 SPEC 7 screens at 360 and 1440 px (G-W5)", () => {
  test("public and sign-in screens", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.getByRole("button", { name: "Sign in as Admin" })).toBeVisible();
    await expectLabelled(page, "/sign-in");
    await shot(page, "sign-in");
    await page.getByRole("button", { name: "Reset demo data" }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await shot(page, "reset-dialog");
    await page.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click();

    // admin-created user with a temp password -> set-password
    await page.evaluate(() => {
      const key = "psf:v1:users";
      const users = JSON.parse(window.localStorage.getItem(key) ?? "[]") as { id: string }[];
      const next = users.map((u) => (u.id === "u-support2" ? { ...u, mustSetPassword: true } : u));
      window.localStorage.setItem(key, JSON.stringify(next));
    });
    await page.reload();
    await page.getByLabel("Email").fill("support2@chandrahonda.demo");
    await page.getByLabel("Password").fill("Demo@2026");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Set your password" })).toBeVisible();
    await expectLabelled(page, "/set-password");
    await shot(page, "set-password");
  });

  test("customer form screens and link states", async ({ page }) => {
    await page.goto(`/f/${makeToken("v-t11-shots", 1)}`);
    await expect(page.getByRole("button", { name: "Start" })).toBeVisible();
    await expectLabelled(page, "form welcome");
    await shot(page, "form-welcome");
    await page.getByRole("button", { name: "Start" }).click();
    await expect(page.getByText("Step 1 of 6").first()).toBeVisible();
    await expectLabelled(page, "form step 1");
    await shot(page, "form-step");
    await page.getByRole("button", { name: "Back" }).click();
    await fillUntilCallback(page, { q6: "1 Very poor", q15: "Yes" });
    await expect(page.locator('[data-question="Q15"]')).toBeVisible();
    await expectLabelled(page, "form callback");
    await shot(page, "form-callback");
    await page.locator('[data-question="Q15"]').getByRole("button", { name: "Yes" }).click();
    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page.getByText("Our team will call you soon")).toBeVisible();
    await shot(page, "form-thank-you");

    await page.goto(`/f/${makeToken("v-s001", 1, "JC-24-1001")}`);
    await expect(page.getByText("Thank you — already submitted")).toBeVisible();
    await shot(page, "form-already-submitted");
    await page.goto(`/f/${makeToken("v-t11-old", 8, "JC-24-1042")}`);
    await expect(page.getByText(/This feedback link has expired/)).toBeVisible();
    await shot(page, "form-expired");
    await page.goto("/f/not-a-real-token");
    await expect(page.getByText(/link/i).first()).toBeVisible();
    await shot(page, "form-invalid");
  });

  test("support screens and not-allowed", async ({ page }) => {
    await signInAs(page, "support1");
    await visit(page, "/support", "My feedback links", "support-list");
    await page.goto("/support/new");
    await page.getByLabel("Job card number").fill("JC-24-1042");
    await page.getByRole("button", { name: "Look up" }).click();
    await expect(page.getByLabel("Phone")).toBeVisible();
    await expectLabelled(page, "/support/new");
    await shot(page, "support-new");
    await page.getByRole("button", { name: "Generate link" }).click();
    await expect(page.getByTestId("link-url")).toBeVisible();
    await shot(page, "support-new-link");
    await page.goto("/admin");
    await expect(page.getByText("You don't have access to this page")).toBeVisible();
    await shot(page, "not-allowed");
  });

  test("admin screens", async ({ page }) => {
    await signInAs(page, "admin");
    await visit(page, "/admin", "Overview", "admin-overview");
    await expect(page.getByTestId("kpi-tile")).toHaveCount(5);
    await visit(page, "/admin/alerts", "Alerts", "admin-alerts");
    await page.getByRole("button", { name: /Kavitha P/ }).click();
    await expect(page.getByRole("button", { name: "Contacted", exact: true }).last()).toBeVisible();
    await expectLabelled(page, "alert drawer");
    await shot(page, "admin-alert-drawer");
    await page.keyboard.press("Escape");
    await visit(page, "/admin/responses", "Responses", "admin-responses");
    await visit(page, "/admin/responses/r-s005", "Response", "admin-response-detail");
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await expectLabelled(page, "response edit");
    await shot(page, "admin-response-edit");
    await visit(page, "/admin/responses/deleted", /Recently deleted/, "admin-deleted");
    await visit(page, "/admin/audit", "Audit log", "admin-audit");
    await visit(page, "/admin/users", "Support users", "admin-users");
    expect((await stored(page, "users")).length).toBeGreaterThan(0);
  });
});
