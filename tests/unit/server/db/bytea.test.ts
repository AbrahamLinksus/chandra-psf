// @vitest-environment node
import { pgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { bytea } from "@/server/db/schema/bytea";

const col = pgTable("t", { h: bytea("h") }).h;

describe("bytea", () => {
  it("passes a Buffer to the driver unchanged", () => {
    const b = Buffer.from([1, 2]);
    expect(col.mapToDriverValue(b)).toBe(b);
  });

  it("reads a hex string or a Uint8Array back as a Buffer", () => {
    expect(col.mapFromDriverValue("\\x0102")).toEqual(Buffer.from([1, 2]));
    expect(col.mapFromDriverValue(new Uint8Array([3, 4]))).toEqual(Buffer.from([3, 4]));
  });
});
