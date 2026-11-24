/* eslint-disable max-lines-per-function -- describe blocks group several specs */
import {
  expect,
  test,
  type APIRequestContext,
  type Page,
  type PlaywrightWorkerArgs,
  type Response,
} from "@playwright/test";
import { adminApi, createBranch, createSupportUser, rpcCall } from "../../support/e2e";

const TEMP = "Temp-Pass-4471";
const OWN = "My-Own-Pass-2026!";
// Opaque token: the customer form route renders (a "link not valid" state) without needing a seeded visit.
const FORM_PATH = "/f/eyJ2Ijoidi1jc3AifQ.abcd2345";

/** Collects `securitypolicyviolation` events (they survive full page loads through a binding). */
async function watchViolations(page: Page): Promise<string[]> {
  const seen: string[] = [];
  await page.exposeFunction("__cspReport", (what: string) => seen.push(what));
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (e) => {
      const w = window as unknown as { __cspReport: (s: string) => void };
      w.__cspReport(`${e.violatedDirective} blocked ${e.blockedURI}`);
    });
  });
  page.on("console", (m) => {
    if (m.type() === "error" && /Content.Security.Policy/i.test(m.text())) seen.push(m.text());
  });
  return seen;
}

function directives(csp: string): Map<string, string> {
  return new Map(
    csp
      .split(";")
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => {
        const [name = "", ...rest] = d.split(/\s+/);
        return [name, rest.join(" ")] as const;
      }),
  );
}

function cspOf(res: Pick<Response, "headers"> | null): string {
  const csp = res?.headers()["content-security-policy"];
  expect(csp, "Content-Security-Policy header").toBeTruthy();
  return String(csp);
}

/** Asserts every directive the task promises; returns the request's nonce. */
function expectPolicy(csp: string): string {
  const d = directives(csp);
  expect(d.get("default-src")).toBe("'self'");
  expect(d.get("script-src")).toMatch(/^'self' 'nonce-[^']+' 'strict-dynamic'$/);
  expect(d.get("style-src")).toMatch(/^'self' 'nonce-[^']+'$/);
  expect(d.get("img-src")).toBe("'self' data: blob:");
  expect(d.get("font-src")).toBe("'self'");
  expect(d.get("connect-src")).toBe("'self'");
  expect(d.get("frame-ancestors")).toBe("'none'");
  expect(d.get("base-uri")).toBe("'self'");
  expect(d.get("form-action")).toBe("'self'");
  expect(d.get("object-src")).toBe("'none'");
  expect(csp).not.toContain("unsafe-eval");
  expect(d.get("script-src")).not.toContain("unsafe-inline");
  return /'nonce-([^']+)'/.exec(d.get("script-src") ?? "")?.[1] ?? "";
}

/** A support session made through the API (no browser sign-in), returned as cookies. */
async function supportCookies(
  playwright: PlaywrightWorkerArgs["playwright"],
  base: string,
  email: string,
): Promise<Awaited<ReturnType<APIRequestContext["storageState"]>>["cookies"]> {
  const request = await playwright.request.newContext({ baseURL: base });
  const api = { request, origin: new URL(base).origin };
  await rpcCall(api, "auth", "signIn", [email, TEMP]);
  await rpcCall(api, "auth", "setOwnPassword", [OWN]);
  const { cookies } = await request.storageState();
  await request.dispose();
  return cookies;
}

test.describe("T-31s Content-Security-Policy", () => {
  // Header checks need no viewport: run them once, with plain requests (no public RPC calls).
  test("AC-1 sign-in and the customer form carry the strict policy, a new nonce per request, and scripts use it", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "desktop-1440", "the header does not depend on the viewport");
    const res = await page.request.get("/sign-in");
    const first = expectPolicy(cspOf(res));
    const html = await res.text();
    const nonces = [...html.matchAll(/<script[^>]*\snonce="([^"]+)"/g)].map((m) => m[1]);
    expect(first).not.toBe("");
    expect(nonces.length).toBeGreaterThan(0);
    expect(new Set(nonces)).toEqual(new Set([first]));
    const second = expectPolicy(cspOf(await page.request.get("/sign-in")));
    expect(second).not.toBe(first);
    expectPolicy(cspOf(await page.request.get(FORM_PATH)));
  });

  test("AC-1 AC-2 admin and support pages carry the policy; no violations across sign-in, customer form, admin navigation, a toast and support", async ({
    page,
    playwright,
    baseURL,
  }, info) => {
    const base = String(baseURL);
    const desktop = (page.viewportSize()?.width ?? 0) >= 768;
    const stamp = `${info.project.name}.${String(Date.now())}`;
    const api = await adminApi(playwright, base);
    let support: Awaited<ReturnType<typeof supportCookies>> = [];
    if (desktop) {
      const branch = await createBranch(api, { name: `CSP ${stamp}`, city: "Chennai" });
      const email = `csp.${stamp}@chandrahonda.in`;
      await createSupportUser(api, {
        name: "Csp Aide",
        email,
        tempPassword: TEMP,
        branchId: branch.id,
      });
      support = await supportCookies(playwright, base, email);
    }
    const adminCookies = (await api.request.storageState()).cookies;
    await api.request.dispose();

    const seen = await watchViolations(page);
    await page.goto("/sign-in");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await page.goto(FORM_PATH);
    await page.waitForLoadState("networkidle");

    await page.context().addCookies(adminCookies);
    expectPolicy(cspOf(await page.goto("/admin")));
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    const nav = page.getByRole("navigation", {
      name: desktop ? "Admin" : "Admin tabs",
      exact: true,
    });
    await nav.getByRole("link", { name: "Alerts" }).click();
    await expect(page).toHaveURL(/\/admin\/alerts$/);

    // A toast (sonner injects styles): make sign-out fail so the shell shows toast.error.
    await page.route("**/api/rpc/auth/signOut", (route) =>
      route.fulfill({
        json: { ok: false, error: { code: "INTERNAL", message: "Could not sign out" } },
      }),
    );
    if (!desktop) await page.getByRole("button", { name: "More" }).click();
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page.getByText("Could not sign out")).toBeVisible();

    if (desktop) {
      await page.context().clearCookies();
      await page.context().addCookies(support);
      expectPolicy(cspOf(await page.goto("/support")));
      await expect(page).toHaveURL(/\/support$/);
      await page.waitForLoadState("networkidle");
    }
    expect(seen).toEqual([]);
  });
});
