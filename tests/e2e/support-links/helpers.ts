import type { Page, PlaywrightWorkerArgs } from "@playwright/test";
import {
  createAdvisor,
  createBranch,
  createSupportUser,
  rpcCall,
  type AppApi,
} from "../../support/e2e";
import { sharedAdminApi } from "../admin-users/sharedAdmin";

type Playwright = PlaywrightWorkerArgs["playwright"];

const TEMP = "Temp-Pass-4471";
const OWN = "My-Own-Pass-2026!";
export const SHOT = ".results/T-03c";

type Cookies = Awaited<ReturnType<AppApi["request"]["storageState"]>>["cookies"];

export interface Staff {
  userId: string;
  email: string;
  branchId: string;
  advisorId: string;
  api: AppApi;
  cookies: Cookies;
}

const rand = (): string => Math.random().toString(36).slice(2, 6);

export function adminOf(playwright: Playwright, base: string): Promise<AppApi> {
  return sharedAdminApi(playwright, base);
}

/** A new branch (with advisor Suresh) and its Support user; short email so the 360 px list holds. */
export async function newBranch(
  playwright: Playwright,
  base: string,
  o: { label: string; name: string },
): Promise<{ branchId: string; advisorId: string; staff: Staff }> {
  const admin = await adminOf(playwright, base);
  const { id: branchId } = await createBranch(admin, {
    name: `${o.label} ${Date.now().toString(36)}${rand()}`,
    city: "Chennai",
  });
  const { id: advisorId } = await createAdvisor(admin, { branchId, name: "Suresh" });
  const staff = await newStaff(playwright, base, { branchId, advisorId, name: o.name });
  return { branchId, advisorId, staff };
}

async function signInOwn(playwright: Playwright, base: string, email: string, password: string) {
  const request = await playwright.request.newContext({ baseURL: base });
  const api = { request, origin: new URL(base).origin };
  await rpcCall(api, "auth", "signIn", [email, password]);
  return api;
}

/** A Support user in an existing branch, signed in with its own password. */
export async function newStaff(
  playwright: Playwright,
  base: string,
  o: { branchId: string; advisorId: string; name: string },
): Promise<Staff> {
  const admin = await adminOf(playwright, base);
  const email = `${o.name.slice(0, 3).toLowerCase()}${rand()}@ch.in`;
  const { id: userId } = await createSupportUser(admin, {
    name: o.name,
    email,
    tempPassword: TEMP,
    branchId: o.branchId,
  });
  const api = await signInOwn(playwright, base, email, TEMP);
  await rpcCall(api, "auth", "setOwnPassword", [OWN]);
  const cookies = (await api.request.storageState()).cookies;
  return { userId, email, branchId: o.branchId, advisorId: o.advisorId, api, cookies };
}

/** Signs the same user in again (a move to another branch ends the old sessions). */
export async function signInAgain(
  playwright: Playwright,
  base: string,
  staff: Staff,
): Promise<Staff> {
  const api = await signInOwn(playwright, base, staff.email, OWN);
  return { ...staff, api, cookies: (await api.request.storageState()).cookies };
}

/** Signs the browser in as `staff`. */
export async function actAs(page: Page, staff: Staff): Promise<void> {
  await page.context().clearCookies();
  await page.context().addCookies(staff.cookies);
}

export interface CardOpts {
  phone?: string | null;
  reg?: string;
}

/** A job card created through the API; returns its number and id. */
export async function makeCard(
  staff: Staff,
  o: CardOpts = {},
): Promise<{ no: string; id: string }> {
  const no = `JC-24-${String(1000 + Math.floor(Math.random() * 8999))}`;
  const card = await rpcCall<{ id: string }>(staff.api, "jobCards", "createJobCard", [
    {
      requestId: crypto.randomUUID(),
      jobCardNo: no,
      customerName: "Ramesh Kumar",
      phone: o.phone === undefined ? "98400 12345" : o.phone,
      regNo: o.reg ?? "tn09bx4521",
      model: "Activa 6G",
      serviceType: "Paid service",
      serviceDate: new Date().toISOString().slice(0, 10),
      advisorId: staff.advisorId,
    },
  ]);
  return { no, id: card.id };
}
