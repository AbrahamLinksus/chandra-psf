import { date, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { advisors } from "./advisors";
import { branches } from "./branches";
import { vehicleTypeEnum } from "./enums";
import { users } from "./users";

export const jobCards = pgTable(
  "job_cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id),
    jobCardNo: text("job_card_no").notNull(),
    jobCardKey: text("job_card_key").notNull(),
    customerName: text("customer_name"),
    phone: text("phone"),
    phoneKey: text("phone_key"),
    regNo: text("reg_no"),
    regNoKey: text("reg_no_key"),
    model: text("model").notNull(),
    vehicleType: vehicleTypeEnum("vehicle_type").notNull(),
    serviceType: text("service_type").notNull(),
    serviceDate: date("service_date").notNull(),
    advisorId: uuid("advisor_id")
      .notNull()
      .references(() => advisors.id),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createRequestId: uuid("create_request_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    erasedAt: timestamp("erased_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("job_cards_branch_key_uq").on(t.branchId, t.jobCardKey),
    uniqueIndex("job_cards_create_request_uq").on(t.createRequestId),
    index("job_cards_phone_key_idx").on(t.phoneKey),
    index("job_cards_reg_no_key_idx").on(t.regNoKey),
    index("job_cards_branch_date_idx").on(t.branchId, t.serviceDate),
  ],
);
