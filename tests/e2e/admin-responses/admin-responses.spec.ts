/* eslint-disable max-lines-per-function -- describe blocks group many tests */
import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "../../support/e2e";

const PASSWORD = "Demo@2026";
const ALL = "/admin/responses?from=2000-01-01&to=2100-01-01";
const Q6 = "Were you satisfied with the behaviour of the Service Advisor?";
const Q12 = "Were you satisfied with the overall service experience?";
const Q15 = "Would you like someone from our service team to call you?";
const width = (page: Page): number => page.viewportSize()?.width ?? 0;
const shot = async (page: Page, name: string): Promise<void> => {
  await page.screenshot({ path: `.results/T-08/${name}-${String(width(page))}.png` });
};

async function openAdmin(page: Page, path: string): Promise<void> {
  await signInAs(page, "admin");
  await page.goto(path);
}

async function stored<T>(page: Page, key: string): Promise<T> {
  return page.evaluate(
    (k) => JSON.parse(window.localStorage.getItem(`psf:v1:${k}`) ?? "null") as T,
    key,
  );
}

interface Resp {
  id: string;
  answers: Record<string, unknown>;
  deletedAt: string | null;
}
interface Audit {
  action: string;
  entityId: string;
  oldValue: unknown;
  newValue: unknown;
  note?: string;
}

const responseOf = async (page: Page, id: string): Promise<Resp | undefined> =>
  (await stored<Resp[]>(page, "responses")).find((r) => r.id === id);
const auditOf = async (page: Page, action: string): Promise<Audit[]> =>
  (await stored<Audit[]>(page, "audit")).filter((a) => a.action === action);

async function pick(page: Page, group: string, value: string): Promise<void> {
  await page
    .getByRole("group", { name: group })
    .getByRole("button", { name: value, exact: true })
    .click();
}

async function confirmPassword(page: Page, password: string): Promise<void> {
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
}

async function editAndSave(page: Page, edits: [string, string][]): Promise<void> {
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  for (const [q, v] of edits) await pick(page, q, v);
  await page.getByRole("button", { name: "Save changes" }).click();
  await confirmPassword(page, PASSWORD);
  await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
}

async function openCount(page: Page): Promise<number | null> {
  if (width(page) < 768) return null;
  const badge = page.getByLabel(/\d+ open/).first();
  return (await badge.count()) === 0 ? 0 : Number((await badge.innerText()).trim());
}

test.describe("T-08 admin responses", () => {
  test("S-11 AC-10 filters by service date, vehicle type, model and advisor; row opens detail", async ({
    page,
  }) => {
    await openAdmin(page, ALL);
    await expect(page.getByRole("heading", { name: "Responses" })).toBeVisible();
    const rows = page.locator("tr[data-response-id]");
    await expect(rows.first()).toBeVisible();
    const total = await rows.count();
    expect(total).toBeGreaterThan(5);
    await shot(page, "list");
    const advisor = (await rows.first().locator("td").nth(3).innerText()).trim();
    await page.getByRole("combobox", { name: "Advisor" }).click();
    await page.getByRole("option", { name: advisor, exact: true }).click();
    await expect(page).toHaveURL(/advisorId=/);
    await expect.poll(async () => rows.count()).toBeLessThan(total);
    for (const a of await rows.locator("td:nth-child(4)").allInnerTexts()) {
      expect(a.trim()).toBe(advisor);
    }
    await page.goto(ALL);
    await expect(rows.first()).toBeVisible();
    const model = (await rows.first().locator("td").nth(2).innerText()).trim();
    await page.getByRole("combobox", { name: "Model" }).click();
    await page.getByRole("option", { name: model, exact: true }).click();
    await expect(page).toHaveURL(/model=/);
    await expect.poll(async () => rows.count()).toBeLessThanOrEqual(total);
    for (const m of await rows.locator("td:nth-child(3)").allInnerTexts()) {
      expect(m.trim()).toBe(model);
    }
    await page.goto(ALL);
    await expect(rows.first()).toBeVisible();
    await page.getByRole("combobox", { name: "Vehicle type" }).click();
    await page.getByRole("option", { name: "scooter", exact: true }).click();
    await expect(page).toHaveURL(/vehicleType=scooter/);
    await expect(page.getByRole("heading", { name: "Responses" })).toBeVisible();
    await expect.poll(async () => rows.count()).toBeGreaterThan(0);
    const scooters = await rows.count();
    await page.goto(`${ALL}&vehicleType=motorcycle`);
    await expect(page.getByRole("heading", { name: "Responses" })).toBeVisible();
    await expect.poll(async () => (await rows.count()) + scooters).toBe(total);
    await page.goto("/admin/responses?from=2100-01-01&to=2100-01-02");
    await expect(page.getByText("No responses match these filters")).toBeVisible();
    await page.goto(ALL);
    const first = rows.first();
    const customer = (await first.locator("td").nth(1).innerText()).trim();
    const id = (await first.getAttribute("data-response-id")) ?? "";
    await first.click();
    await expect(page).toHaveURL(new RegExp(`/admin/responses/${id}$`));
    await expect(page.getByText(customer).first()).toBeVisible();
  });

  test("detail shows every answer with follow-ups plus visit and vehicle info", async ({
    page,
  }) => {
    await openAdmin(page, "/admin/responses/r-s020");
    await expect(page.getByRole("heading", { name: "Response" })).toBeVisible();
    const labels = ["Customer", "Job card", "Registration", "Vehicle", "Service date"];
    for (const label of [...labels, "Advisor", "Phone", "Submitted"]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(page.locator('[data-question="Q6a"]')).toContainText("Didn't answer queries");
    expect(await page.locator("[data-question]").count()).toBeGreaterThanOrEqual(15);
    await expect(page.getByTestId("response-alert")).toContainText("Callback requested");
  });

  test("G-W3 long text is truncated in the list, full on detail; <script> shows as plain text", async ({
    page,
  }) => {
    const longName = "Venkatachalapathi ".repeat(8).trim();
    const script = "<script>window.__pwned=1</script>";
    await openAdmin(page, "/admin/responses");
    await expect(page.getByRole("heading", { name: "Responses" })).toBeVisible();
    await page.evaluate(
      ([name, text]) => {
        type Row = Record<string, unknown>;
        const read = (k: string) =>
          JSON.parse(window.localStorage.getItem(`psf:v1:${k}`) ?? "[]") as Row[];
        const write = (k: string, v: unknown) => {
          window.localStorage.setItem(`psf:v1:${k}`, JSON.stringify(v));
        };
        const responses = read("responses");
        const resp = responses.find((r) => r["id"] === "r-s001") as {
          visitId: string;
          answers: Row;
        };
        resp.answers["Q14"] = text;
        write("responses", responses);
        const visit = read("visits").find((v) => v["id"] === resp.visitId);
        const cards = read("jobCards");
        const card = cards.find((c) => c["jobCardNo"] === visit?.["jobCardNo"]);
        if (card) card["customerName"] = name;
        write("jobCards", cards);
      },
      [longName, script],
    );
    await page.goto(ALL);
    const cell = page.locator('tr[data-response-id="r-s001"] td').nth(1);
    await expect(cell).toBeVisible();
    const clipped = await cell.evaluate((el) => {
      const s = getComputedStyle(el);
      return s.textOverflow === "ellipsis" && el.scrollWidth > el.clientWidth;
    });
    expect(clipped).toBe(true);
    await page.goto("/admin/responses/r-s001");
    await expect(page.getByText(longName).first()).toBeVisible();
    await expect(page.locator('[data-question="Q14"]')).toContainText(script);
    expect(await page.evaluate(() => "__pwned" in window)).toBe(false);
    await expect(page.locator("main script")).toHaveCount(0);
    await shot(page, "script-text");
  });

  test("AC-9 G-01 edit Q6 2 → 4: Q6a disappears live; wrong password saves nothing; correct password audits", async ({
    page,
  }) => {
    await openAdmin(page, "/admin/responses/r-s020");
    await expect(page.locator('[data-question="Q6a"]')).toBeVisible();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await pick(page, Q6, "4");
    await expect(page.locator('[data-question="Q6a"]')).toHaveCount(0);
    await page.getByRole("button", { name: "Save changes" }).click();
    await confirmPassword(page, "wrong-password");
    await expect(page.getByText("Password incorrect")).toBeVisible();
    expect((await responseOf(page, "r-s020"))?.answers["Q6"]).toBe(2);
    expect(await auditOf(page, "response.edit")).toHaveLength(0);
    await shot(page, "wrong-password");
    await confirmPassword(page, PASSWORD);
    await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
    const saved = await responseOf(page, "r-s020");
    expect(saved?.answers["Q6"]).toBe(4);
    expect(saved?.answers["Q6a"]).toBeUndefined();
    const [entry] = await auditOf(page, "response.edit");
    expect(entry?.oldValue).toEqual({ Q6: 2, Q6a: { options: ["Didn't answer queries"] } });
    expect(entry?.newValue).toEqual({ Q6: 4 });
  });

  test("S-08 Q12 1 → 4 auto-resolves the only-reason alert; Q15 No → Yes opens 'Callback requested' (+1 badge)", async ({
    page,
  }) => {
    await openAdmin(page, "/admin/responses/r-s001");
    await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
    const start = await openCount(page);
    await editAndSave(page, [[Q12, "1"]]);
    await expect(page.getByTestId("response-alert")).toContainText("Q12 rated 1");
    await expect(page.getByTestId("response-alert")).toContainText("Open");
    if (start !== null) {
      await expect(page.getByLabel(/\d+ open/).first()).toHaveText(String(start + 1));
    }

    await editAndSave(page, [[Q12, "4"]]);
    await expect(page.getByTestId("response-alert")).toContainText("Resolved");
    if (start !== null && start > 0) {
      await expect(page.getByLabel(/\d+ open/).first()).toHaveText(String(start));
    }
    const resolved = (await auditOf(page, "alert.status")).at(-1);
    expect(resolved?.newValue).toBe("resolved");
    expect(resolved?.note).toBe("Auto-resolved: no alert reason after edit");
    await shot(page, "auto-resolved");

    await page.goto("/admin/responses/r-s002");
    await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
    const before = await openCount(page);
    await expect(page.getByTestId("response-alert")).toHaveCount(0);
    await editAndSave(page, [[Q15, "Yes"]]);
    await expect(page.getByTestId("response-alert")).toContainText("Callback requested");
    await expect(page.getByTestId("response-alert")).toContainText("Open");
    if (before !== null) {
      await expect(page.getByLabel(/\d+ open/).first()).toHaveText(String(before + 1));
    }
    expect(await auditOf(page, "alert.create")).toHaveLength(2);
    await shot(page, "callback-alert");
  });

  test("US-21 G-03 delete (confirm + password) then restore (password) keeps answers and alert status", async ({
    page,
  }) => {
    await openAdmin(page, "/admin/responses/deleted");
    await expect(page.getByText("Nothing deleted")).toBeVisible();

    const answers = JSON.stringify((await responseOf(page, "r-s020"))?.answers);
    await page.goto("/admin/responses/r-s020");
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByText("Delete this response?")).toBeVisible();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    await confirmPassword(page, "wrong-password");
    await expect(page.getByText("Password incorrect")).toBeVisible();
    expect((await responseOf(page, "r-s020"))?.deletedAt).toBeNull();
    await confirmPassword(page, PASSWORD);
    await expect(page).toHaveURL(/\/admin\/responses$/);
    await expect(page.locator('tr[data-response-id="r-s020"]')).toHaveCount(0);

    await page
      .getByRole("main")
      .getByRole("link", { name: /Recently deleted/ })
      .click();
    const row = page.locator('li[data-response-id="r-s020"]');
    await expect(row).toBeVisible();
    await shot(page, "recently-deleted");
    await row.getByRole("button", { name: "Restore" }).click();
    await confirmPassword(page, "wrong-password");
    await expect(page.getByText("Password incorrect")).toBeVisible();
    await confirmPassword(page, PASSWORD);
    await expect(page.getByText("Nothing deleted")).toBeVisible();

    expect(JSON.stringify((await responseOf(page, "r-s020"))?.answers)).toBe(answers);
    await page.goto(ALL);
    await expect(page.locator('tr[data-response-id="r-s020"]')).toBeVisible();
    await page.goto("/admin/responses/r-s020");
    await expect(page.getByTestId("response-alert")).toContainText("Contacted");
    const actions = (await stored<Audit[]>(page, "audit"))
      .map((a) => a.action)
      .filter((a) => a.startsWith("response."));
    expect(actions).toEqual(["response.delete", "response.restore"]);
  });

  test("S-13 a failed edit keeps the edited answers and shows 'Couldn't save, try again'", async ({
    page,
  }) => {
    await openAdmin(page, "/admin/responses/r-s020?demoFail=1");
    await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await pick(page, Q6, "4");
    await page.getByRole("button", { name: "Save changes" }).click();
    await confirmPassword(page, PASSWORD);
    await expect(page.getByText("Couldn't save, try again").first()).toBeVisible();
    await shot(page, "save-failed");
    expect((await responseOf(page, "r-s020"))?.answers["Q6"]).toBe(2);
    expect(await auditOf(page, "response.edit")).toHaveLength(0);
    const cancel = page.getByRole("dialog").getByRole("button", { name: "Cancel" });
    if (await cancel.isVisible()) await cancel.click();
    await expect(
      page.getByRole("group", { name: Q6 }).getByRole("button", { name: "4", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Retry" }).click();
    await confirmPassword(page, PASSWORD);
    await expect.poll(async () => (await responseOf(page, "r-s020"))?.answers["Q6"]).toBe(4);
  });

  test("D-15 G-W2 a support user opening /admin/responses lands on /not-allowed with no data", async ({
    page,
  }) => {
    await signInAs(page, "support1");
    await page.goto(ALL);
    await expect(page).toHaveURL(/\/not-allowed$/);
    await expect(page.getByText("You don't have access to this page")).toBeVisible();
    await expect(page.locator("tr[data-response-id]")).toHaveCount(0);
    await page.goto("/admin/responses/r-s020");
    await expect(page).toHaveURL(/\/not-allowed$/);
    await expect(page.locator("[data-question]")).toHaveCount(0);
  });
});
