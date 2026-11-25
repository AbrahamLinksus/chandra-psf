import { randomBytes } from "node:crypto";
import type { PlaywrightWorkerArgs } from "@playwright/test";
import { rpcCall as rawRpcCall, type AppApi } from "../../support/e2e";
import { adminLogin, previewUrl } from "./env";

type Playwright = PlaywrightWorkerArgs["playwright"];
type Cookies = Awaited<ReturnType<AppApi["request"]["storageState"]>>["cookies"];

export interface Actor {
  email: string;
  api: AppApi;
  cookies: Cookies;
}

export interface World {
  admin: AppApi;
  velachery: { branchId: string; advisorId: string };
  tambaram: { branchId: string };
  support: Actor;
  velacheryAdmin: Actor;
  tambaramAdmin: Actor;
}

export const uniq = (): string => Date.now().toString(36) + randomBytes(2).toString("hex");
/** A throwaway password that lives in memory only. */
const secret = (): string => `Pw-${randomBytes(9).toString("base64url")}-7k!`;

async function client(playwright: Playwright): Promise<AppApi> {
  const base = previewUrl();
  const request = await playwright.request.newContext({ baseURL: base });
  return { request, origin: base };
}

async function branchId(admin: AppApi, name: string): Promise<string> {
  const found = (
    await rpcCall<{ id: string; name: string }[]>(admin, "branches", "listBranches", [])
  ).find((b) => b.name === name);
  return (
    found?.id ??
    (await rpcCall<{ id: string }>(admin, "branches", "createBranch", [{ name, city: "Chennai" }]))
      .id
  );
}

/** Creates a user with a one-time password, then signs in and sets an own password (in memory). */
async function staff(
  playwright: Playwright,
  admin: AppApi,
  input: { name: string; role: "support" | "branch_admin"; branchId: string },
): Promise<Actor> {
  const email = `${input.name.toLowerCase().replace(/\W+/g, "")}-${uniq()}@example.invalid`;
  const temp = secret();
  await rpcCall(admin, "users", "createUser", [{ ...input, email, tempPassword: temp }]);
  const api = await client(playwright);
  await rpcCall(api, "auth", "signIn", [email, temp]);
  await rpcCall(api, "auth", "setOwnPassword", [secret()]);
  return { email, api, cookies: (await api.request.storageState()).cookies };
}

/**
 * Signs the main admin in once, makes (or reuses) the Velachery and Tambaram branches, and adds
 * throwaway users. `admins: false` skips the two branch admins (the idle test needs none).
 */
export async function buildWorld(
  playwright: Playwright,
  opts: { admins: boolean },
): Promise<World> {
  const admin = await client(playwright);
  const login = adminLogin();
  await rpcCall(admin, "auth", "signIn", [login.email, login.password]);
  const vId = await branchId(admin, "Velachery");
  const tId = await branchId(admin, "Tambaram");
  const advisor = await rpcCall<{ id: string }>(admin, "advisors", "createAdvisor", [
    { branchId: vId, name: `Adv ${uniq()}` },
  ]);
  const support = await staff(playwright, admin, {
    name: "Loop Support",
    role: "support",
    branchId: vId,
  });
  const none: Actor = { email: "", api: admin, cookies: [] };
  const velacheryAdmin = opts.admins
    ? await staff(playwright, admin, { name: "Vel Boss", role: "branch_admin", branchId: vId })
    : none;
  const tambaramAdmin = opts.admins
    ? await staff(playwright, admin, { name: "Tam Boss", role: "branch_admin", branchId: tId })
    : none;
  return {
    admin,
    velachery: { branchId: vId, advisorId: advisor.id },
    tambaram: { branchId: tId },
    support,
    velacheryAdmin,
    tambaramAdmin,
  };
}

/** A job card for a (unique) customer, made as the support user. */
export async function makeCard(
  world: World,
  customerName: string,
): Promise<{ id: string; no: string }> {
  const no = `JC-24-${String(1000 + Math.floor(Math.random() * 8999))}`;
  const card = await rpcCall<{ id: string }>(world.support.api, "jobCards", "createJobCard", [
    {
      requestId: crypto.randomUUID(),
      jobCardNo: no,
      customerName,
      phone: "98400 12345",
      regNo: "tn09bx4521",
      model: "Activa 6G",
      serviceType: "Paid service",
      serviceDate: new Date().toISOString().slice(0, 10),
      advisorId: world.velachery.advisorId,
    },
  ]);
  return { id: card.id, no };
}

/**
 * RPC call whose errors keep only their first line. Playwright's own transport errors carry a call
 * log with request headers (cookies), which must never reach the output.
 */
export async function rpcCall<T>(
  api: AppApi,
  repo: string,
  method: string,
  args: unknown[],
): Promise<T> {
  try {
    return await rawRpcCall<T>(api, repo, method, args);
  } catch (err) {
    const first = (err instanceof Error ? err.message : "failed").split("\n")[0] ?? "failed";
    throw new Error(`${repo}.${method}: ${first}`);
  }
}
