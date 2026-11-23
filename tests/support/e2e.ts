import type {
  APIRequestContext,
  BrowserContext,
  Page,
  PlaywrightWorkerArgs,
} from "@playwright/test";

import { existsSync } from "node:fs";
import { open, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const SESSION_KEY = "psf:v1:session";

/** Sets the session in localStorage before the app loads (no UI). Call before `page.goto`. */
export async function signInAs(page: Page, who: "admin" | "support1" | "support2"): Promise<void> {
  await page.addInitScript(
    ([key, userId]) => {
      if (key !== undefined && userId !== undefined) {
        window.localStorage.setItem(key, JSON.stringify({ userId }));
      }
    },
    [SESSION_KEY, `u-${who}`],
  );
}

/** Wipes every `psf:` key; the app reseeds on the next load. */
export async function resetDemo(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const k of Object.keys(window.localStorage)) {
      if (k.startsWith("psf:")) window.localStorage.removeItem(k);
    }
  });
}

/** A second tab in the same browser context (shares localStorage). */
export async function openSecondTab(context: BrowserContext, url: string): Promise<Page> {
  const tab = await context.newPage();
  await tab.goto(url);
  return tab;
}

// ---- Phase 2: real server. The admin comes from globalSetup (`admin init`); there is no seed file. ----

/** Password the admin chooses after the one-time password; meets the password policy. */
export const E2E_ADMIN_NEW_PASSWORD = "Chandra-E2E-Admin-2026!";

/** An API client bound to the app's origin; its cookie jar keeps the session. */
export interface AppApi {
  request: APIRequestContext;
  origin: string;
}

type RpcBody<T> = { ok: true; value: T } | { ok: false; error: { code: string; message: string } };

function need(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `${name} is not set: Playwright globalSetup (tests/e2e/global-setup.ts) did not run`,
    );
  }
  return v;
}

/** The first admin's email and the one-time password printed by `admin init` in globalSetup. */
export function adminCredentials(): { email: string; oneTimePassword: string } {
  return { email: need("E2E_ADMIN_EMAIL"), oneTimePassword: need("E2E_ADMIN_PASSWORD") };
}

/** POST /api/rpc/<repo>/<method> as the browser would. Throws a clear message on any error Result. */
export async function rpcCall<T>(
  api: AppApi,
  repo: string,
  method: string,
  args: unknown[],
): Promise<T> {
  const res = await api.request.post(`/api/rpc/${repo}/${method}`, {
    headers: { origin: api.origin },
    data: { args },
  });
  const body = (await res.json()) as RpcBody<T>;
  if (body.ok) return body.value;
  if (body.error.code === "UNAVAILABLE") {
    throw new Error(
      `RPC ${repo}.${method} is not available yet (UNAVAILABLE): the task that implements it has not landed`,
    );
  }
  throw new Error(`RPC ${repo}.${method} failed: ${body.error.code} ${body.error.message}`);
}

/** Done-marker and lock files next to the PGlite dir (both match `.pglite*` in .gitignore). */
export function adminPasswordFiles(): { marker: string; lock: string } {
  const url = need("DATABASE_URL");
  const dir = resolve(url.replace(/^pglite:/, ""));
  return { marker: `${dir}.admin-password-set`, lock: `${dir}.admin-password-lock` };
}

const LOCK_POLL_MS = 100;
const LOCK_WAIT_MS = 30_000;

async function replaceOneTimePassword(api: AppApi, marker: string): Promise<void> {
  const { email, oneTimePassword } = adminCredentials();
  await rpcCall(api, "auth", "signIn", [email, oneTimePassword]);
  await rpcCall(api, "auth", "setOwnPassword", [E2E_ADMIN_NEW_PASSWORD]);
  await writeFile(marker, "done");
}

/** Replaces the one-time password once per run: one worker holds the lock, the others wait for the marker. */
async function ensureOwnPassword(api: AppApi): Promise<void> {
  const { marker, lock } = adminPasswordFiles();
  const deadline = Date.now() + LOCK_WAIT_MS;
  while (!existsSync(marker)) {
    let handle;
    try {
      handle = await open(lock, "wx");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
      if (Date.now() > deadline) throw new Error("timed out waiting for the admin password switch");
      await new Promise((r) => setTimeout(r, LOCK_POLL_MS));
      continue;
    }
    try {
      if (!existsSync(marker)) await replaceOneTimePassword(api, marker);
    } finally {
      await handle.close();
      await rm(lock, { force: true });
    }
  }
}

/** A signed-in main-admin client: own password replaced once per run, then the session cookie. */
export async function adminApi(
  playwright: PlaywrightWorkerArgs["playwright"],
  baseURL: string,
): Promise<AppApi> {
  const request = await playwright.request.newContext({ baseURL });
  const api: AppApi = { request, origin: new URL(baseURL).origin };
  await ensureOwnPassword(api);
  await rpcCall(api, "auth", "signIn", [adminCredentials().email, E2E_ADMIN_NEW_PASSWORD]);
  return api;
}

/** Creates a branch through RPC (branches.createBranch). */
export function createBranch(
  api: AppApi,
  input: { name: string; city: string },
): Promise<{ id: string }> {
  return rpcCall(api, "branches", "createBranch", [input]);
}

/** Creates a support user through RPC (users.createSupportUser); the user must set a password at first sign-in. */
export function createSupportUser(
  api: AppApi,
  input: { name: string; email: string; tempPassword: string; branchId?: string },
): Promise<{ id: string }> {
  return rpcCall(api, "users", "createSupportUser", [input]);
}
