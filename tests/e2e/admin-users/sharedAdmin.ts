import type { Page, PlaywrightWorkerArgs } from "@playwright/test";
import { existsSync } from "node:fs";
import { open, readFile, rm, writeFile } from "node:fs/promises";

import {
  adminApi,
  adminPasswordFiles,
  isLockBusy,
  listBranches,
  type AppApi,
} from "../../support/e2e";

/**
 * One admin sign-in shared by the T-32 specs (all workers, both screen sizes). The shared sign-in
 * limit counts every in-flight admin sign-in, so each extra one risks locking the other specs out.
 */
const POLL_MS = 100;
const WAIT_MS = 60_000;

type Cookies = Awaited<ReturnType<AppApi["request"]["storageState"]>>["cookies"];

function paths(): { file: string; lock: string } {
  const { marker } = adminPasswordFiles();
  const base = marker.replace(/\.admin-password-set$/, "");
  return { file: `${base}.t32-admin-session`, lock: `${base}.t32-admin-session-lock` };
}

async function withCookies(
  playwright: PlaywrightWorkerArgs["playwright"],
  baseURL: string,
  cookies: Cookies,
): Promise<AppApi> {
  const request = await playwright.request.newContext({
    baseURL,
    storageState: { cookies, origins: [] },
  });
  return { request, origin: new URL(baseURL).origin };
}

async function stillSignedIn(api: AppApi): Promise<boolean> {
  try {
    await listBranches(api);
    return true;
  } catch {
    return false;
  }
}

async function takeLock(lock: string): Promise<void> {
  const deadline = Date.now() + WAIT_MS;
  for (;;) {
    try {
      const handle = await open(lock, "wx");
      await handle.close();
      return;
    } catch (err) {
      if (!isLockBusy(err)) throw err;
      if (Date.now() > deadline) throw new Error("timed out waiting for the shared admin session");
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
  }
}

/** A signed-in main-admin client reusing the run's saved session; signs in only when none works. */
export async function sharedAdminApi(
  playwright: PlaywrightWorkerArgs["playwright"],
  baseURL: string,
): Promise<AppApi> {
  const { file, lock } = paths();
  await takeLock(lock);
  try {
    if (existsSync(file)) {
      const saved = await withCookies(
        playwright,
        baseURL,
        JSON.parse(await readFile(file, "utf8")) as Cookies,
      );
      if (await stillSignedIn(saved)) return saved;
      await saved.request.dispose();
    }
    const fresh = await adminApi(playwright, baseURL);
    await writeFile(file, JSON.stringify((await fresh.request.storageState()).cookies));
    return fresh;
  } finally {
    await rm(lock, { force: true });
  }
}

/** Gives the browser page the shared admin session; returns the API client for set-up calls. */
export async function sharedAdminInBrowser(
  page: Page,
  playwright: PlaywrightWorkerArgs["playwright"],
  baseURL: string,
): Promise<AppApi> {
  const api = await sharedAdminApi(playwright, baseURL);
  await page.context().addCookies((await api.request.storageState()).cookies);
  return api;
}
