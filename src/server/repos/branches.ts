import "server-only";
import { and, count, eq, sql } from "drizzle-orm";
import type { BranchRepo } from "@/data/access";
import { err, ok, type Result } from "@/data/access/result";
import type { Branch } from "@/domain/types";
import { writeAudit } from "../audit";
import { endUserSessions } from "../auth/session";
import { guard, type RequestCtx } from "../ctx";
import { branches, users } from "../db/schema";
import { requireMainAdmin, requireStaff, scopeOf } from "../scope";

const NAME_IN_USE = "A branch with this name already exists";
const UNIQUE_VIOLATION = "23505";
type Row = typeof branches.$inferSelect;
type Patch = { name?: string; city?: string };

/** True for a Postgres unique-constraint error, whether the driver puts the code on the error or its cause. */
export function isUniqueViolation(e: unknown): boolean {
  const codeOf = (x: unknown): unknown =>
    typeof x === "object" && x !== null && "code" in x ? x.code : undefined;
  const cause = typeof e === "object" && e !== null && "cause" in e ? e.cause : undefined;
  return codeOf(e) === UNIQUE_VIOLATION || codeOf(cause) === UNIQUE_VIOLATION;
}

function toBranch(row: Row): Branch {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
  };
}

function snapshot(row: Row): { name: string; city: string; active: boolean } {
  return { name: row.name, city: row.city, active: row.active };
}

/** Trims the fields given; an empty one is a VALIDATION error naming the field. */
function cleanPatch(p: Patch): Result<Patch> {
  const out: Patch = {};
  for (const key of ["name", "city"] as const) {
    const raw = p[key];
    if (raw === undefined) continue;
    const value = raw.trim();
    if (!value) return err("VALIDATION", `Enter the branch ${key}.`, [key]);
    out[key] = value;
  }
  return ok(out);
}

export class ServerBranchRepo implements BranchRepo {
  constructor(protected readonly ctx: RequestCtx) {}

  listBranches: BranchRepo["listBranches"] = () =>
    guard(this.ctx, "branches.listBranches", "read", async () => {
      const auth = requireStaff(this.ctx);
      if (!auth.ok) return auth;
      const scope = scopeOf(auth.value.user);
      const rows = await this.ctx.db
        .select({
          branch: branches,
          staffCount: sql<number>`(select count(*)::int from users u where u.branch_id = "branches"."id" and u.active)`,
        })
        .from(branches)
        .where(scope.kind === "branch" ? eq(branches.id, scope.branchId) : undefined)
        .orderBy(branches.name);
      return ok(rows.map((r) => ({ ...toBranch(r.branch), staffCount: r.staffCount })));
    });

  createBranch: BranchRepo["createBranch"] = (input) =>
    guard(this.ctx, "branches.createBranch", "write", async () => {
      const auth = requireMainAdmin(this.ctx);
      if (!auth.ok) return auth;
      const clean = cleanPatch(input);
      if (!clean.ok) return clean;
      const { name, city } = clean.value;
      if (!name || !city)
        return err("VALIDATION", "Enter the branch name and city.", ["name", "city"]);
      if (await this.nameTaken(name)) return err("NAME_IN_USE", NAME_IN_USE, ["name"]);
      return this.save(() =>
        this.ctx.db.transaction(async (tx) => {
          const [created] = await tx.insert(branches).values({ name, city }).returning();
          if (!created) throw new Error("insert returned no row");
          await writeAudit(this.ctx, tx, {
            action: "branch.create",
            entityType: "branch",
            entityId: created.id,
            branchId: created.id,
            newValue: snapshot(created),
          });
          return created;
        }),
      );
    });

  updateBranch: BranchRepo["updateBranch"] = (id, patch) =>
    guard(this.ctx, "branches.updateBranch", "write", async () => {
      const auth = requireMainAdmin(this.ctx);
      if (!auth.ok) return auth;
      const clean = cleanPatch(patch);
      if (!clean.ok) return clean;
      const before = await this.load(id);
      if (!before) return err("NOT_FOUND", "That branch no longer exists.");
      if (clean.value.name && (await this.nameTaken(clean.value.name, id))) {
        return err("NAME_IN_USE", NAME_IN_USE, ["name"]);
      }
      return this.save(() =>
        this.ctx.db.transaction(async (tx) => {
          const [row] = await tx
            .update(branches)
            .set(clean.value)
            .where(eq(branches.id, id))
            .returning();
          if (!row) throw new Error("update returned no row");
          await writeAudit(this.ctx, tx, {
            action: "branch.update",
            entityType: "branch",
            entityId: id,
            branchId: id,
            oldValue: snapshot(before),
            newValue: snapshot(row),
          });
          return row;
        }),
      );
    });

  setBranchActive: BranchRepo["setBranchActive"] = (id, active) =>
    guard(this.ctx, "branches.setBranchActive", "write", async () => {
      const auth = requireMainAdmin(this.ctx);
      if (!auth.ok) return auth;
      const before = await this.load(id);
      if (!before) return err("NOT_FOUND", "That branch no longer exists.");
      if (before.active === active) return ok(toBranch(before));
      const after = await this.ctx.db.transaction(async (tx) => {
        const [row] = await tx
          .update(branches)
          .set({ active })
          .where(eq(branches.id, id))
          .returning();
        if (!row) throw new Error("update returned no row");
        if (!active) {
          const staff = await tx.select({ id: users.id }).from(users).where(eq(users.branchId, id));
          for (const s of staff) await endUserSessions(tx, s.id);
        }
        await writeAudit(this.ctx, tx, {
          action: active ? "branch.reactivate" : "branch.deactivate",
          entityType: "branch",
          entityId: id,
          branchId: id,
          oldValue: { active: before.active },
          newValue: { active: row.active },
        });
        return row;
      });
      return ok(toBranch(after));
    });

  private async save(run: () => Promise<Row>): Promise<Result<Branch>> {
    try {
      return ok(toBranch(await run()));
    } catch (e) {
      if (isUniqueViolation(e)) return err("NAME_IN_USE", NAME_IN_USE, ["name"]);
      throw e;
    }
  }

  private async load(id: string): Promise<Row | undefined> {
    const [row] = await this.ctx.db.select().from(branches).where(eq(branches.id, id)).limit(1);
    return row;
  }

  private async nameTaken(name: string, exceptId?: string): Promise<boolean> {
    const same = sql`lower(${branches.name}) = lower(${name})`;
    const [row] = await this.ctx.db
      .select({ n: count() })
      .from(branches)
      .where(exceptId ? and(same, sql`${branches.id} <> ${exceptId}`) : same);
    return (row?.n ?? 0) > 0;
  }
}
