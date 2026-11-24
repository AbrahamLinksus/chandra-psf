import { eq } from "drizzle-orm";
import { afterEach, beforeEach } from "vitest";
import { auditLog, sessions, users } from "@/server/db/schema";
import type { SessionUser } from "@/server/ctx";
import { ServerUserRepo } from "@/server/repos/users";
import { makeServerCtx, must, seedUser } from "../../../support/serverCtx";

export const GHOST = "00000000-0000-0000-0000-000000000000";
export const TEMP = "Welcome-Temp-91";
export const LAST_ADMIN = "There must be at least one active main admin.";
type Env = Awaited<ReturnType<typeof makeServerCtx>>;
export type Role = "support" | "branch_admin" | "main_admin";
export let env: Env;

beforeEach(async () => {
  env = await makeServerCtx();
});
afterEach(async () => {
  await env.client.close();
});

export function signIn(user: Partial<SessionUser> & Pick<SessionUser, "id" | "role">): void {
  env.ctx.session = {
    sessionId: "00",
    createdAt: env.clock.now(),
    lastActiveAt: env.clock.now(),
    user: {
      name: "Boss",
      email: "boss@chandrahonda.in",
      branchId: null,
      mustSetPassword: false,
      ...user,
    },
  };
}
export async function asMainAdmin(active = true): Promise<string> {
  const id = await seedUser(env.db, { role: "main_admin", active });
  signIn({ id, role: "main_admin" });
  return id;
}
export async function asBranchAdmin(branchId: string): Promise<string> {
  const id = await seedUser(env.db, { role: "branch_admin", branchId });
  signIn({ id, role: "branch_admin", branchId });
  return id;
}
export async function asSupport(branchId: string): Promise<void> {
  signIn({ id: await seedUser(env.db, { role: "support", branchId }), role: "support", branchId });
}
export const repo = () => new ServerUserRepo(env.ctx);
export const audits = async (action: string) =>
  (await env.db.select().from(auditLog)).filter((a) => a.action === action);
export const sessionCount = async (userId: string) =>
  (await env.db.select().from(sessions).where(eq(sessions.userId, userId))).length;
export const row = async (id: string) =>
  must((await env.db.select().from(users).where(eq(users.id, id)))[0]);
export const code = (r: { ok: boolean }) =>
  (r as unknown as { error?: { code: string } }).error?.code;
export const message = (r: { ok: boolean }) =>
  (r as unknown as { error?: { message: string } }).error?.message;

export async function add(input: {
  email: string;
  role: Role;
  branchId: string | null;
  name?: string;
}): Promise<string> {
  const r = await repo().createUser({ name: "Arun", tempPassword: TEMP, ...input });
  if (!r.ok) throw new Error(`createUser failed: ${r.error.message}`);
  return r.value.id;
}
