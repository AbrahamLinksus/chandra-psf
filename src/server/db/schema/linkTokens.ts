import { sql } from "drizzle-orm";
import { index, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { bytea } from "./bytea";
import { users } from "./users";
import { visits } from "./visits";

export const linkTokens = pgTable(
  "link_tokens",
  {
    tokenHash: bytea("token_hash").primaryKey(),
    visitId: uuid("visit_id")
      .notNull()
      .references(() => visits.id),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
  },
  (t) => [
    index("link_tokens_visit_idx").on(t.visitId),
    uniqueIndex("link_tokens_one_live_uq")
      .on(t.visitId)
      .where(sql`${t.supersededAt} is null`),
  ],
);
