import { index, integer, jsonb, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { alertStatusEnum } from "./enums";
import { branches } from "./branches";
import { responses } from "./responses";

export const alerts = pgTable(
  "alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    responseId: uuid("response_id")
      .notNull()
      .references(() => responses.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id),
    reasons: jsonb("reasons").notNull(),
    status: alertStatusEnum("status").notNull().default("open"),
    notes: jsonb("notes").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    version: integer("version").notNull().default(1),
  },
  (t) => [
    uniqueIndex("alerts_response_uq").on(t.responseId),
    index("alerts_branch_status_idx").on(t.branchId, t.status),
  ],
);
