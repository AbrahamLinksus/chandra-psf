import { pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { erasureSourceEnum } from "./enums";

/** No personal data: only the id of the erased job card. */
export const erasureJournal = pgTable("erasure_journal", {
  jobCardId: uuid("job_card_id").primaryKey(),
  erasedAt: timestamp("erased_at", { withTimezone: true }).notNull().defaultNow(),
  source: erasureSourceEnum("source").notNull(),
});
