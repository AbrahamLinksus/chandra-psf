import "server-only";
import { and, eq, sql, type SQL } from "drizzle-orm";
import type { AdvisorRepo } from "@/data/access";
import { err, ok, type Result } from "@/data/access/result";
import { isAdmin } from "@/domain/roles";
import type { Advisor } from "@/domain/types";
import { writeAudit } from "../audit";
import { guard, type RequestCtx, type Scope } from "../ctx";
import { advisors, branches } from "../db/schema";
import { branchFilter, inScope, requireAdmin, requireStaff, scopeOf } from "../scope";
import { isUniqueViolation } from "./branches";

const NAME_IN_USE = "An advisor with this name already exists in this branch";
const NO_ADVISOR = "That advisor no longer exists.";
const NO_BRANCH = "That branch no longer exists.";
type Row = typeof advisors.$inferSelect;
type AuditDb = Parameters<typeof writeAudit>[1];

function toAdvisor(row: Row): Advisor {
  return { id: row.id, name: row.name, branchId: row.branchId, active: row.active };
}

function cleanName(raw: string): Result<string> {
  const name = raw.trim();
  return name ? ok(name) : err("VALIDATION", "Enter the advisor name.", ["name"]);
}

export class ServerAdvisorRepo implements AdvisorRepo {
  constructor(protected readonly ctx: RequestCtx) {}

  listAdvisors: AdvisorRepo["listAdvisors"] = (f) =>
    guard(this.ctx, "advisors.listAdvisors", "read", async () => {
      const auth = requireStaff(this.ctx);
      if (!auth.ok) return auth;
      const { user } = auth.value;
      const conds: (SQL | undefined)[] = [
        branchFilter(advisors.branchId, scopeOf(user), f.branchId),
      ];
      // Support only ever sees the active advisors of their own branch.
      if (f.activeOnly || !isAdmin(user.role)) conds.push(eq(advisors.active, true));
      const rows = await this.ctx.db
        .select({ advisor: advisors, branchName: branches.name })
        .from(advisors)
        .innerJoin(branches, eq(branches.id, advisors.branchId))
        .where(and(...conds))
        .orderBy(sql`lower(${advisors.name})`);
      return ok(rows.map((r) => ({ ...toAdvisor(r.advisor), branchName: r.branchName })));
    });

  createAdvisor: AdvisorRepo["createAdvisor"] = (input) =>
    guard(this.ctx, "advisors.createAdvisor", "write", async () => {
      const scope = this.adminScope();
      if (!scope.ok) return scope;
      const name = cleanName(input.name);
      if (!name.ok) return name;
      if (!inScope(scope.value, input.branchId)) return err("NOT_FOUND", NO_BRANCH);
      const [branch] = await this.ctx.db
        .select({ id: branches.id })
        .from(branches)
        .where(eq(branches.id, input.branchId))
        .limit(1);
      if (!branch) return err("NOT_FOUND", NO_BRANCH);
      return this.save(() =>
        this.ctx.db.transaction(async (tx) => {
          const [row] = await tx
            .insert(advisors)
            .values({ branchId: input.branchId, name: name.value })
            .returning();
          if (!row) throw new Error("insert returned no row");
          await this.audit(tx, "advisor.create", row, undefined);
          return row;
        }),
      );
    });

  renameAdvisor: AdvisorRepo["renameAdvisor"] = (id, rawName) =>
    guard(this.ctx, "advisors.renameAdvisor", "write", async () => {
      const scope = this.adminScope();
      if (!scope.ok) return scope;
      const name = cleanName(rawName);
      if (!name.ok) return name;
      const before = await this.load(scope.value, id);
      if (!before) return err("NOT_FOUND", NO_ADVISOR);
      return this.save(() =>
        this.ctx.db.transaction(async (tx) => {
          const [row] = await tx
            .update(advisors)
            .set({ name: name.value })
            .where(eq(advisors.id, id))
            .returning();
          if (!row) throw new Error("update returned no row");
          await this.audit(tx, "advisor.rename", row, { name: before.name });
          return row;
        }),
      );
    });

  setAdvisorActive: AdvisorRepo["setAdvisorActive"] = (id, active) =>
    guard(this.ctx, "advisors.setAdvisorActive", "write", async () => {
      const scope = this.adminScope();
      if (!scope.ok) return scope;
      const before = await this.load(scope.value, id);
      if (!before) return err("NOT_FOUND", NO_ADVISOR);
      if (before.active === active) return ok(toAdvisor(before));
      return this.save(() =>
        this.ctx.db.transaction(async (tx) => {
          const [row] = await tx
            .update(advisors)
            .set({ active })
            .where(eq(advisors.id, id))
            .returning();
          if (!row) throw new Error("update returned no row");
          const action = active ? "advisor.reactivate" : "advisor.deactivate";
          await this.audit(tx, action, row, { active: before.active });
          return row;
        }),
      );
    });

  private adminScope(): Result<Scope> {
    const auth = requireAdmin(this.ctx);
    return auth.ok ? ok(scopeOf(auth.value.user)) : auth;
  }

  /** The advisor, or undefined when missing or outside the caller's branch. */
  private async load(scope: Scope, id: string): Promise<Row | undefined> {
    const [row] = await this.ctx.db.select().from(advisors).where(eq(advisors.id, id)).limit(1);
    return row && inScope(scope, row.branchId) ? row : undefined;
  }

  private async save(run: () => Promise<Row>): Promise<Result<Advisor>> {
    try {
      return ok(toAdvisor(await run()));
    } catch (e) {
      if (isUniqueViolation(e)) return err("NAME_IN_USE", NAME_IN_USE, ["name"]);
      throw e;
    }
  }

  private audit(
    tx: AuditDb,
    action: string,
    row: Row,
    old: Record<string, unknown> | undefined,
  ): Promise<void> {
    return writeAudit(this.ctx, tx, {
      action,
      entityType: "advisor",
      entityId: row.id,
      branchId: row.branchId,
      oldValue: old,
      newValue: { name: row.name, active: row.active },
    });
  }
}
