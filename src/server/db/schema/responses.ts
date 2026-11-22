import { index, integer, jsonb, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { questionnaires } from "./questionnaires";
import { visits } from "./visits";

export const responses = pgTable(
  "responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    visitId: uuid("visit_id")
      .notNull()
      .references(() => visits.id),
    questionsVersion: integer("questions_version")
      .notNull()
      .references(() => questionnaires.version),
    answers: jsonb("answers").notNull(),
    submissionId: uuid("submission_id").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    version: integer("version").notNull().default(1),
  },
  (t) => [
    uniqueIndex("responses_visit_uq").on(t.visitId),
    index("responses_deleted_at_idx").on(t.deletedAt),
  ],
);
