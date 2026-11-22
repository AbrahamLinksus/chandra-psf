import { integer, jsonb, pgTable, timestamp } from "drizzle-orm/pg-core";

export const questionnaires = pgTable("questionnaires", {
  version: integer("version").primaryKey(),
  definition: jsonb("definition").notNull(),
  installedAt: timestamp("installed_at", { withTimezone: true }).notNull().defaultNow(),
});
