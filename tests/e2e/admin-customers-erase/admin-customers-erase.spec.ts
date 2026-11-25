/* eslint-disable max-lines-per-function -- each test plays one scenario end to end */
import { expect, test, type Page } from "@playwright/test";
import { E2E_ADMIN_NEW_PASSWORD, rpcCall, type AppApi } from "../../support/e2e";
import { sharedAdminInBrowser } from "../admin-users/sharedAdmin";
import { newBranch, type Staff } from "../support-links/helpers";

const SHOT = ".results/T-25";
const RANGE = { from: "2000-01-01", to: "2100-01-01" };
const Q14 = "Advisor was rude, ring me on my second number";
const ANSWERS = {
  Q1: 5,
  Q2: "Yes",
  Q3: "No",
  Q4: "Yes",
  Q5: "Yes",
  Q6: 5,
  Q7: "Yes",
  Q8: "Yes",
  Q9: "Yes",
  Q10: "Yes",
  Q11: 5,
  Q12: 4,
  Q13: "Yes",
  Q14,
  Q15: "No",
};
const digits = (): string => `9${String(Math.floor(Math.random() * 1e9)).padStart(9, "0")}`;
const spaced = (p: string): string => `${p.slice(0, 5)} ${p.slice(5)}`;
const regOf = (): string =>
  `TN${String(10 + Math.floor(Math.random() * 80))}ZZ${String(1000 + Math.floor(Math.random() * 8999))}`;
const step = { password: E2E_ADMIN_NEW_PASSWORD };

interface Made {
  id: string;
  code: string;
}

async function card(
  staff: Staff,
  o: { name: string; phone: string; reg: string; date: string },
): Promise<Made> {
  const c = await rpcCall<{ id: string }>(staff.api, "jobCards", "createJobCard", [
    {
      requestId: crypto.randomUUID(),
      jobCardNo: `JC-25-${String(1000 + Math.floor(Math.random() * 8999))}`,
      customerName: o.name,
      phone: o.phone,
      regNo: o.reg,
      model: "Activa 6G",
      serviceType: "Paid service",
      serviceDate: o.date,
      advisorId: staff.advisorId,
    },
  ]);
  const link = await rpcCall<{ url: string }>(staff.api, "visits", "createVisitLink", [
    { jobCardId: c.id },
  ]);
  return { id: c.id, code: new URL(link.url).pathname.replace("/f/", "") };
}

async function answered(staff: Staff, o: Parameters<typeof card>[1]): Promise<Made> {
  const made = await card(staff, o);
  await rpcCall(staff.api, "feedback", "submitResponse", [made.code, ANSWERS]);
  return made;
}

async function responseIdIn(admin: AppApi, branchId: string): Promise<string> {
  const rows = await rpcCall<{ id: string }[]>(admin, "responses", "listResponses", [
    { ...RANGE, branchId },
  ]);
  return rows[0]?.id ?? "";
}

const overviewCount = async (admin: AppApi, branchId: string): Promise<number | null> =>
  (
    await rpcCall<{ kpis: { responses: { value: number | null } } }>(
      admin,
      "analytics",
      "getAnalytics",
      [{ ...RANGE, branchId }],
    )
  ).kpis.responses.value;

async function search(page: Page, text: string): Promise<void> {
  await page.getByLabel("Phone number or registration number").fill(text);
  await page.getByRole("button", { name: "Search" }).click();
}

const overflow = (page: Page): Promise<number> =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test.describe("T-25 erase a customer", () => {
  test("test_s21_main_admin_erases_ramesh_and_lakshmi_is_untouched", async ({
    page,
    playwright,
    baseURL,
  }, info) => {
    const base = String(baseURL);
    const admin = await sharedAdminInBrowser(page, playwright, base);
    const vel = await newBranch(playwright, base, { label: "Velachery", name: "Kavitha" });
    const tam = await newBranch(playwright, base, { label: "Tambaram", name: "Mohan" });
    const phone = digits();
    const rameshReg = regOf();
    const lakshmiReg = regOf();
    const ramesh = await answered(vel.staff, {
      name: "Ramesh Kumar",
      phone: spaced(phone),
      reg: rameshReg,
      date: "2026-11-14",
    });
    const lakshmi = await answered(tam.staff, {
      name: "Lakshmi Kumar",
      phone: `+91 ${spaced(phone)}`,
      reg: lakshmiReg,
      date: "2026-11-20",
    });

    // An edit puts Q14 into the audit old/new values; then delete a second Ramesh-free response
    const rameshResponse = await responseIdIn(admin, vel.branchId);
    const detail = await rpcCall<{ version: number }>(admin, "responses", "getResponse", [
      rameshResponse,
    ]);
    await rpcCall(admin, "responses", "editResponse", [
      rameshResponse,
      { ...ANSWERS, Q12: 3 },
      detail.version,
      step,
    ]);
    const velBefore = await overviewCount(admin, vel.branchId);
    const tamBefore = await overviewCount(admin, tam.branchId);
    expect(velBefore).toBe(1);
    expect(tamBefore).toBe(1);

    await page.goto("/admin/customers");
    await search(page, spaced(phone));
    const boxes = page.getByRole("checkbox");
    await expect(boxes).toHaveCount(2);
    await expect(page.getByRole("button", { name: "Erase selected" })).toBeDisabled();
    const rameshRow = page.getByRole("listitem").filter({ hasText: "Ramesh Kumar" });
    await rameshRow.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Erase selected" }).click();

    const dialog = page.getByTestId("erase-dialog");
    await expect(dialog).toContainText("This can't be undone");
    await expect(dialog).toContainText("1 row");
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `${SHOT}/erase-dialog-${info.project.name}.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `${SHOT}/erase-dialog-390.png` });

    // Wrong password: nothing is erased, the dialog stays with its message
    await dialog.getByLabel("Your password").fill("Not-My-Password-1");
    await dialog.getByRole("button", { name: "Confirm erase" }).click();
    await expect(dialog.getByRole("alert")).toContainText("That password is not right");
    expect(
      await rpcCall<unknown[]>(admin, "customers", "searchCustomers", [{ phone }]),
    ).toHaveLength(2);

    await dialog.getByLabel("Your password").fill(E2E_ADMIN_NEW_PASSWORD);
    await dialog.getByRole("button", { name: "Confirm erase" }).click();
    await expect(page.getByTestId("erase-notice")).toHaveText("Erased customer");
    await expect(dialog).toHaveCount(0);
    await page.screenshot({ path: `${SHOT}/erased-${info.project.name}.png` });

    // Search: phone and reg no gone for Ramesh; Lakshmi still there
    const found = await rpcCall<{ jobCardId: string; customerName: string | null }[]>(
      admin,
      "customers",
      "searchCustomers",
      [{ phone }],
    );
    expect(found.map((r) => r.jobCardId)).toEqual([lakshmi.id]);
    expect(
      await rpcCall<unknown[]>(admin, "customers", "searchCustomers", [{ regNo: rameshReg }]),
    ).toHaveLength(0);
    await expect(page.getByRole("listitem").filter({ hasText: "Lakshmi Kumar" })).toBeVisible();

    // Q14 gone from Ramesh's response; Lakshmi's keeps hers
    const after = await rpcCall<{ response: { answers: Record<string, unknown> } }>(
      admin,
      "responses",
      "getResponse",
      [rameshResponse],
    );
    expect(after.response.answers["Q14"]).toBeUndefined();
    expect(after.response.answers["Q12"]).toBe(3);
    const hers = await rpcCall<{ response: { answers: Record<string, unknown> } }>(
      admin,
      "responses",
      "getResponse",
      [await responseIdIn(admin, tam.branchId)],
    );
    expect(hers.response.answers["Q14"]).toBe(Q14);

    // Overview counts unchanged
    expect(await overviewCount(admin, vel.branchId)).toBe(velBefore);
    expect(await overviewCount(admin, tam.branchId)).toBe(tamBefore);

    // Audit: old/new values of Ramesh's response are "[erased]"; the erase itself is counted
    const audit = await rpcCall<{
      entries: { action: string; entityId: string; oldValue: unknown; newValue: unknown }[];
    }>(admin, "audit", "listAudit", [{ branchId: vel.branchId }]);
    const mine = audit.entries.filter((e) => e.entityId === rameshResponse);
    expect(mine.map((e) => e.action)).toContain("response.edit");
    for (const e of mine) {
      expect(e.newValue).toBe("[erased]");
      expect(e.oldValue).toBe("[erased]");
      expect(JSON.stringify(e)).not.toContain("rude");
    }
    const erase = await rpcCall<{ entries: { newValue: unknown; oldValue: unknown }[] }>(
      admin,
      "audit",
      "listAudit",
      [{ action: "customer.erase" }],
    );
    expect(erase.entries[0]?.newValue).toEqual({ count: 1 });
    expect(JSON.stringify(erase.entries[0])).not.toMatch(/Ramesh|rude/);
    expect(ramesh.code).not.toEqual(lakshmi.code);

    // His link no longer opens; hers still shows its state
    await page.goto(`/f/${ramesh.code}`);
    await expect(page.getByText("Link not valid")).toBeVisible();
    await page.goto(`/f/${lakshmi.code}`);
    await expect(page.getByText("Link not valid")).toHaveCount(0);
  });

  test("a deleted response of an erased customer loses Q14 in Recently deleted too", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const base = String(baseURL);
    const admin = await sharedAdminInBrowser(page, playwright, base);
    const b = await newBranch(playwright, base, { label: "Deleted", name: "Arun" });
    const phone = digits();
    await answered(b.staff, {
      name: "Ramesh Kumar",
      phone,
      reg: regOf(),
      date: "2026-11-14",
    });
    const id = await responseIdIn(admin, b.branchId);
    await rpcCall(admin, "responses", "deleteResponse", [id, step]);
    const before = await rpcCall<{ id: string; customerName: string }[]>(
      admin,
      "responses",
      "listDeleted",
      [],
    );
    expect(before.find((r) => r.id === id)?.customerName).toBe("Ramesh Kumar");

    await page.goto("/admin/customers");
    await search(page, phone);
    await page
      .getByRole("listitem")
      .filter({ hasText: "Ramesh Kumar" })
      .getByRole("checkbox")
      .check();
    await page.getByRole("button", { name: "Erase selected" }).click();
    await page.getByTestId("erase-dialog").getByLabel("Your password").fill(E2E_ADMIN_NEW_PASSWORD);
    await page.getByRole("button", { name: "Confirm erase" }).click();
    await expect(page.getByTestId("erase-notice")).toHaveText("Erased customer");

    const rows = await rpcCall<{ id: string; customerName: string }[]>(
      admin,
      "responses",
      "listDeleted",
      [],
    );
    expect(JSON.stringify(rows.filter((r) => r.id === id))).not.toContain("Ramesh");
    const detail = await rpcCall<{ response: { answers: Record<string, unknown> } }>(
      admin,
      "responses",
      "getResponse",
      [id],
    ).catch(() => null);
    if (detail) expect(detail.response.answers["Q14"]).toBeUndefined();
  });

  test("an unanswered open link stops working after the erase, and a branch admin cannot erase (G-4)", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const base = String(baseURL);
    const admin = await sharedAdminInBrowser(page, playwright, base);
    const b = await newBranch(playwright, base, { label: "Open", name: "Ravi" });
    const open = await card(b.staff, {
      name: "Ramesh Kumar",
      phone: digits(),
      reg: regOf(),
      date: "2026-11-14",
    });
    await page.goto(`/f/${open.code}`);
    await expect(page.getByText("Link not valid")).toHaveCount(0);

    const res = await b.staff.api.request.post("/api/rpc/customers/eraseCustomers", {
      headers: { origin: b.staff.api.origin },
      data: { args: [[open.id], step] },
    });
    expect(await res.json()).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });

    await rpcCall(admin, "customers", "eraseCustomers", [[open.id], step]);
    await page.goto(`/f/${open.code}`);
    await expect(page.getByText("Link not valid")).toBeVisible();
  });
});
