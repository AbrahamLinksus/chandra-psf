/* eslint-disable max-lines-per-function -- each test plays one scenario end to end */
import { readFile } from "node:fs/promises";
import { expect, test, type Page, type PlaywrightWorkerArgs } from "@playwright/test";
import { createUser, rpcCall, type AppApi } from "../../support/e2e";
import { sharedAdminInBrowser } from "../admin-users/sharedAdmin";
import { newBranch, type Staff } from "../support-links/helpers";

const SHOT = ".results/T-24";
const uniq = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const digits = (): string => `9${String(Math.floor(Math.random() * 1e9)).padStart(9, "0")}`;
const spaced = (p: string): string => `${p.slice(0, 5)} ${p.slice(5)}`;
const regOf = (): string =>
  `TN${String(10 + Math.floor(Math.random() * 80))}ZZ${String(1000 + Math.floor(Math.random() * 8999))}`;

async function card(
  staff: Staff,
  o: { name: string; phone: string; reg: string; date: string },
): Promise<string> {
  const c = await rpcCall<{ id: string }>(staff.api, "jobCards", "createJobCard", [
    {
      requestId: crypto.randomUUID(),
      jobCardNo: `JC-24-${String(1000 + Math.floor(Math.random() * 8999))}`,
      customerName: o.name,
      phone: o.phone,
      regNo: o.reg,
      model: "Activa",
      serviceType: "Paid service",
      serviceDate: o.date,
      advisorId: staff.advisorId,
    },
  ]);
  return c.id;
}

async function search(page: Page, text: string): Promise<void> {
  await page.getByLabel("Phone number or registration number").fill(text);
  await page.getByRole("button", { name: "Search" }).click();
}

async function overflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

async function branchAdmin(
  playwright: PlaywrightWorkerArgs["playwright"],
  base: string,
  admin: AppApi,
  branchId: string,
): Promise<AppApi> {
  const email = `ba${uniq()}@ch.in`;
  await createUser(admin, {
    name: "Bala",
    email,
    tempPassword: "Temp-Pass-4471",
    role: "branch_admin",
    branchId,
  });
  const request = await playwright.request.newContext({ baseURL: base });
  const api = { request, origin: new URL(base).origin };
  await rpcCall(api, "auth", "signIn", [email, "Temp-Pass-4471"]);
  await rpcCall(api, "auth", "setOwnPassword", ["My-Own-Pass-2026!"]);
  return api;
}

test.describe("T-24 customer privacy requests", () => {
  test("test_s21_main_admin_finds_one_customer_in_two_branches_and_downloads_one", async ({
    page,
    playwright,
    baseURL,
  }, info) => {
    const base = String(baseURL);
    const admin = await sharedAdminInBrowser(page, playwright, base);
    const vel = await newBranch(playwright, base, { label: "Velachery", name: "Kavitha" });
    const tam = await newBranch(playwright, base, { label: "Tambaram", name: "Mohan" });
    const phone = digits();
    const reg = regOf();
    await card(vel.staff, { name: "Ramesh Kumar", phone: spaced(phone), reg, date: "2026-11-14" });
    await card(tam.staff, {
      name: "Lakshmi Kumar",
      phone: `+91 ${spaced(phone)}`,
      reg: regOf(),
      date: "2026-11-20",
    });
    await card(tam.staff, { name: "Stranger", phone: digits(), reg: regOf(), date: "2026-11-20" });

    await page.goto("/admin/customers");
    await expect(page.getByRole("heading", { name: "Customers" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Download/ })).toHaveCount(0);
    await search(page, spaced(phone));
    const boxes = page.getByRole("checkbox");
    await expect(boxes).toHaveCount(2);
    const items = page.getByRole("listitem").filter({ has: boxes });
    await expect(items.nth(0)).toContainText("Lakshmi Kumar");
    await expect(items.nth(0)).toContainText("20 Nov 2026");
    await expect(items.nth(1)).toContainText("Ramesh Kumar");
    await expect(items.nth(1)).toContainText("14 Nov 2026");
    await expect(page.getByText("Stranger")).toHaveCount(0);
    for (const b of await boxes.all()) await expect(b).not.toBeChecked();
    await expect(page.getByRole("button", { name: /Download/ })).toBeDisabled();
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `${SHOT}/results-${info.project.name}.png` });

    await items.nth(1).getByRole("checkbox").check();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: /Download/ }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^customers-\d{4}-\d{2}-\d{2}\.csv$/);
    const bytes = await readFile(await file.path());
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const csv = bytes.toString("utf8");
    expect(csv).toContain("Ramesh Kumar");
    expect(csv).toContain("Velachery");
    expect(csv).not.toContain("Lakshmi");
    expect(csv).not.toContain("Stranger");
    expect(csv.slice(1).trimEnd().split("\r\n")).toHaveLength(2);
    const head = csv.slice(1).split(String.fromCharCode(13, 10))[0] ?? "";
    expect(head).toMatch(/Q1 [A-Za-z]/);
    expect(head).toContain("Q10a When should we call you?");
    expect(head).not.toContain("Q14");

    const audit = await rpcCall<{ entries: { action: string; newValue: unknown }[] }>(
      admin,
      "audit",
      "listAudit",
      [{}],
    );
    const mine = audit.entries.find((e) => e.action === "customer.export");
    expect(mine?.newValue).toEqual({ count: 1 });
    const dump = JSON.stringify(audit.entries.filter((e) => e.action === "customer.export"));
    for (const s of [phone, "Ramesh", reg]) expect(dump).not.toContain(s);
  });

  test("S-21 no match shows 'No customer found with that number'", async ({
    page,
    playwright,
    baseURL,
  }) => {
    await sharedAdminInBrowser(page, playwright, String(baseURL));
    await page.goto("/admin/customers");
    await search(page, spaced(digits()));
    await expect(page.getByText("No customer found with that number")).toBeVisible();
    await expect(page.getByRole("button", { name: /Download/ })).toHaveCount(0);
  });

  test("a registration number finds the card, and a formula in a name is neutralised in the CSV", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const base = String(baseURL);
    const admin = await sharedAdminInBrowser(page, playwright, base);
    const b = await newBranch(playwright, base, { label: "Formula", name: "Arun" });
    const reg = regOf();
    const id = await card(b.staff, {
      name: '=HYPERLINK("http://evil")',
      phone: spaced(digits()),
      reg,
      date: "2026-11-14",
    });
    await page.goto("/admin/customers");
    await search(page, reg.toLowerCase());
    await expect(page.getByRole("checkbox")).toHaveCount(1);
    const res = await rpcCall<{ filename: string; csv: string }>(
      admin,
      "customers",
      "exportCustomers",
      [[id]],
    );
    expect(res.csv.startsWith("﻿")).toBe(true);
    expect(res.csv).toContain(`"'=HYPERLINK(""http://evil"")"`);
  });

  test("G-4 G-W2 a branch admin and a support user are refused by the RPCs, and the screen shows no results", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const base = String(baseURL);
    const admin = await sharedAdminInBrowser(page, playwright, base);
    const b = await newBranch(playwright, base, { label: `Priv${uniq()}`, name: "Ravi" });
    const ba = await branchAdmin(playwright, base, admin, b.branchId);
    const phone = digits();
    const id = await card(b.staff, {
      name: "Ramesh Kumar",
      phone,
      reg: regOf(),
      date: "2026-11-14",
    });
    for (const api of [ba, b.staff.api]) {
      for (const [method, args] of [
        ["searchCustomers", [{ phone }]],
        ["exportCustomers", [[id]]],
      ] as const) {
        const res = await api.request.post(`/api/rpc/customers/${method}`, {
          headers: { origin: api.origin },
          data: { args },
        });
        expect(await res.json()).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
      }
    }
    await page.context().clearCookies();
    await page.context().addCookies((await ba.request.storageState()).cookies);
    await page.goto("/admin/customers");
    const box = page.getByLabel("Phone number or registration number");
    if (await box.isVisible().catch(() => false)) {
      await search(page, spaced(phone));
      await expect(page.getByText("Not allowed")).toBeVisible();
    }
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    await expect(page.getByText("Ramesh Kumar")).toHaveCount(0);
  });
});
