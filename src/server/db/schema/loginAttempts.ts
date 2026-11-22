import { bigserial, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { bytea } from "./bytea";
import { loginKindEnum } from "./enums";

export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    emailKey: text("email_key").notNull(),
    ipHash: bytea("ip_hash").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    kind: loginKindEnum("kind").notNull(),
    userId: uuid("user_id"),
  },
  (t) => [
    index("login_attempts_email_at_idx").on(t.emailKey, t.at),
    index("login_attempts_ip_at_idx").on(t.ipHash, t.at),
    index("login_attempts_user_at_idx").on(t.userId, t.at),
  ],
);
