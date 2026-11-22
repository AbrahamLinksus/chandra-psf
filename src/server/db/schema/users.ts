import { sql } from "drizzle-orm";
import { boolean, check, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { branches } from "./branches";
import { roleEnum } from "./enums";

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: roleEnum("role").notNull(),
    branchId: uuid("branch_id").references(() => branches.id),
    active: boolean("active").notNull().default(true),
    mustSetPassword: boolean("must_set_password").notNull().default(false),
    otpExpiresAt: timestamp("otp_expires_at", { withTimezone: true }),
    lastSignInAt: timestamp("last_sign_in_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("users_email_lower_uq").on(sql`lower(${t.email})`),
    check("users_main_admin_no_branch", sql`(${t.role} = 'main_admin') = (${t.branchId} is null)`),
  ],
);
