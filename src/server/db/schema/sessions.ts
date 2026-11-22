import { index, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { bytea } from "./bytea";
import { users } from "./users";

export const sessions = pgTable(
  "sessions",
  {
    idHash: bytea("id_hash").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);
