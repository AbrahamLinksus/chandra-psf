import { integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { bytea } from "./bytea";

export const rateLimits = pgTable(
  "rate_limits",
  {
    bucket: text("bucket").notNull(),
    key: bytea("key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.bucket, t.key, t.windowStart] })],
);
