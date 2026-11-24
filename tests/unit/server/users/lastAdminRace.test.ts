// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { users } from "@/server/db/schema";
import type { RequestCtx } from "@/server/ctx";
import { must, seedBranch, seedUser } from "../../../support/serverCtx";
import { LAST_ADMIN, code, env, message, signIn } from "./harness";

vi.mock("server-only", () => ({}));
const { ServerUserRepo } = await import("@/server/repos/users");

/** A separate request context and repo for one signed-in admin, over the same database. */
function actingAs(id: string) {
  signIn({ id, role: "main_admin" });
  const ctx: RequestCtx = { ...env.ctx, session: env.ctx.session };
  return new ServerUserRepo(ctx);
}

async function activeMainAdmins(): Promise<number> {
  const rows = await env.db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, "main_admin"), eq(users.active, true)));
  return rows.length;
}

// PGlite runs one transaction at a time, so these cannot prove the row lock itself;
// they guard the behaviour (exactly one wins, one admin remains) on any database.
describe("two main admins removing each other at once (last-admin race)", () => {
  async function twoAdmins() {
    const branchId = await seedBranch(env.db, "Velachery");
    const a = await seedUser(env.db, { role: "main_admin" });
    const b = await seedUser(env.db, { role: "main_admin" });
    return { branchId, a, b, byA: actingAs(a), byB: actingAs(b) };
  }

  function expectOneWinner(results: { ok: boolean }[]) {
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const lost = results.find((r) => !r.ok);
    expect(code(must(lost))).toBe("CONFLICT");
    expect(message(must(lost))).toBe(LAST_ADMIN);
  }

  it("deactivate / deactivate: one succeeds, one CONFLICT, an active main admin remains", async () => {
    const { a, b, byA, byB } = await twoAdmins();
    expectOneWinner(await Promise.all([byA.setUserActive(b, false), byB.setUserActive(a, false)]));
    expect(await activeMainAdmins()).toBe(1);
  });

  it("demote / demote: one succeeds, one CONFLICT, a main admin remains", async () => {
    const { branchId, a, b, byA, byB } = await twoAdmins();
    const demote = { role: "branch_admin" as const, branchId };
    expectOneWinner(await Promise.all([byA.updateUser(b, demote), byB.updateUser(a, demote)]));
    expect(await activeMainAdmins()).toBe(1);
  });

  it("deactivate / demote: one succeeds, one CONFLICT, a main admin remains", async () => {
    const { branchId, a, b, byA, byB } = await twoAdmins();
    expectOneWinner(
      await Promise.all([
        byA.setUserActive(b, false),
        byB.updateUser(a, { role: "branch_admin", branchId }),
      ]),
    );
    expect(await activeMainAdmins()).toBe(1);
  });
});
