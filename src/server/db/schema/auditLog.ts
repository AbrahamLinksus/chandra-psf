import { sql } from "drizzle-orm";
import { bigserial, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** Append-only: the trigger in drizzle/0000_init.sql rejects DELETE and (unless psf.redact = 'on') UPDATE. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    actorId: uuid("actor_id"),
    actorName: text("actor_name").notNull(),
    branchId: uuid("branch_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    oldValue: jsonb("old_value"),
    newValue: jsonb("new_value"),
    note: text("note"),
  },
  (t) => [
    index("audit_log_branch_id_idx").on(t.branchId, sql`${t.id} desc`),
    index("audit_log_action_id_idx").on(t.action, sql`${t.id} desc`),
  ],
);
