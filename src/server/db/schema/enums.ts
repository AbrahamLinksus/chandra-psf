import { pgEnum } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role_enum", ["support", "branch_admin", "main_admin"]);
export const alertStatusEnum = pgEnum("alert_status", ["open", "contacted", "resolved"]);
export const loginKindEnum = pgEnum("login_kind", ["signin", "stepup"]);
export const erasureSourceEnum = pgEnum("erasure_source", ["request", "retention"]);
export const vehicleTypeEnum = pgEnum("vehicle_type", ["scooter", "motorcycle"]);
