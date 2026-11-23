// @vitest-environment node
import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { users } from "@/server/db/schema";
import {
  branchFilter,
  inScope,
  requireAdmin,
  requireMainAdmin,
  requireStaff,
  scopeOf,
} from "@/server/scope";
import { must } from "../../../support/serverCtx";
import type { SessionInfo } from "@/server/ctx";
import type { StaffRole } from "@/domain/roles";

const sessionOf = (role: StaffRole): SessionInfo => ({
  sessionId: "ab",
  user: {
    id: "u1",
    name: "N",
    email: "n@example.in",
    role,
    branchId: role === "main_admin" ? null : "b1",
    mustSetPassword: false,
  },
  createdAt: new Date(),
  lastActiveAt: new Date(),
});

const sqlOf = (q: ReturnType<typeof branchFilter>) => (q ? new PgDialect().sqlToQuery(q) : null);

describe("scopeOf", () => {
  it("main admin sees all; others get their own branch", () => {
    expect(scopeOf({ role: "main_admin", branchId: null })).toEqual({ kind: "all" });
    expect(scopeOf({ role: "branch_admin", branchId: "b1" })).toEqual({
      kind: "branch",
      branchId: "b1",
    });
    expect(scopeOf({ role: "support", branchId: "b2" })).toEqual({
      kind: "branch",
      branchId: "b2",
    });
  });
  it("throws for a branch user without a branch", () => {
    expect(() => scopeOf({ role: "support", branchId: null })).toThrow();
  });
});

describe("role gates (LLD §19)", () => {
  const roles: StaffRole[] = ["support", "branch_admin", "main_admin"];
  const gates = [
    ["requireStaff", requireStaff, [true, true, true]],
    ["requireAdmin", requireAdmin, [false, true, true]],
    ["requireMainAdmin", requireMainAdmin, [false, false, true]],
  ] as const;

  for (const [name, gate, allowed] of gates) {
    roles.forEach((role, i) => {
      it(`${name}: ${role} ${allowed[i] ? "allowed" : "FORBIDDEN"}`, () => {
        const r = gate({ session: sessionOf(role) });
        if (allowed[i]) {
          expect(r.ok).toBe(true);
          if (r.ok) expect(r.value.user.role).toBe(role);
        } else {
          expect(r.ok).toBe(false);
          if (!r.ok) expect(r.error.code).toBe("FORBIDDEN");
        }
      });
    });
    it(`${name}: no session is UNAUTHENTICATED`, () => {
      const r = gate({ session: null });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe("UNAUTHENTICATED");
    });
  }
});

describe("branchFilter", () => {
  it("a branch scope ignores `wanted` and always filters on its own branch", () => {
    const q = must(
      sqlOf(branchFilter(users.branchId, { kind: "branch", branchId: "mine" }, "other")),
    );
    expect(q.params).toEqual(["mine"]);
  });
  it("an all scope honours `wanted`, or returns no filter", () => {
    expect(must(sqlOf(branchFilter(users.branchId, { kind: "all" }, "wanted"))).params).toEqual([
      "wanted",
    ]);
    expect(branchFilter(users.branchId, { kind: "all" })).toBeUndefined();
  });
});

describe("inScope", () => {
  it("all covers everything, including a null branch", () => {
    expect(inScope({ kind: "all" }, "b1")).toBe(true);
    expect(inScope({ kind: "all" }, null)).toBe(true);
  });
  it("a branch scope covers only its own branch", () => {
    const s = { kind: "branch", branchId: "b1" } as const;
    expect(inScope(s, "b1")).toBe(true);
    expect(inScope(s, "b2")).toBe(false);
    expect(inScope(s, null)).toBe(false);
  });
});
