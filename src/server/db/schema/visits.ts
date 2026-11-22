import { sql } from "drizzle-orm";
import { index, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { branches } from "./branches";
import { jobCards } from "./jobCards";
import { users } from "./users";

export const visits = pgTable(
  "visits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobCardId: uuid("job_card_id")
      .notNull()
      .references(() => jobCards.id),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    replacedBy: uuid("replaced_by").references((): AnyPgColumn => visits.id),
  },
  (t) => [
    index("visits_branch_created_idx").on(t.branchId, sql`${t.createdAt} desc`),
    index("visits_job_card_idx").on(t.jobCardId),
  ],
);
