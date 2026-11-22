import { customType } from "drizzle-orm/pg-core";

/** Postgres bytea as a Node Buffer (hashes only). */
export const bytea = customType<{ data: Buffer; driverData: Buffer | Uint8Array | string }>({
  dataType: () => "bytea",
  toDriver: (value) => value,
  fromDriver: (value) =>
    typeof value === "string" ? Buffer.from(value.replace(/^\\x/, ""), "hex") : Buffer.from(value),
});
