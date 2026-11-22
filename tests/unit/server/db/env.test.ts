// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseServerEnv } from "@/server/env";

const SECRET = "s".repeat(32);
const prod = {
  VERCEL_ENV: "production",
  DATABASE_URL: "postgres://u:p@h/db",
  DATABASE_URL_UNPOOLED: "postgres://u:p@h/db",
  CRON_SECRET: SECRET,
  IP_HASH_PEPPER: SECRET,
  APP_URL: "https://x.example",
};

describe("server env", () => {
  it("rejects pglite: in production", () => {
    expect(() => parseServerEnv({ ...prod, DATABASE_URL: "pglite:memory" })).toThrow(/pglite/);
  });

  it.each(["DATABASE_URL_UNPOOLED", "CRON_SECRET", "IP_HASH_PEPPER", "APP_URL"])(
    "rejects production without %s",
    (key) => {
      expect(() => parseServerEnv({ ...prod, [key]: undefined })).toThrow(new RegExp(key));
    },
  );

  it("rejects a short production secret", () => {
    expect(() => parseServerEnv({ ...prod, CRON_SECRET: "short" })).toThrow(/CRON_SECRET/);
  });

  it("rejects an APP_URL that is not a URL", () => {
    expect(() => parseServerEnv({ ...prod, APP_URL: "not a url" })).toThrow(/APP_URL/);
    expect(() => parseServerEnv({ DATABASE_URL: "pglite:memory", APP_URL: "not a url" })).toThrow(
      /APP_URL/,
    );
  });

  it("rejects an http APP_URL in production but accepts it elsewhere", () => {
    expect(() => parseServerEnv({ ...prod, APP_URL: "http://x.example" })).toThrow(/https/);
    expect(
      parseServerEnv({ DATABASE_URL: "pglite:memory", APP_URL: "http://localhost:3000" }).APP_URL,
    ).toBe("http://localhost:3000");
  });

  it("accepts a complete production env", () => {
    expect(parseServerEnv(prod).VERCEL_ENV).toBe("production");
  });

  it("falls back to pglite:memory under NODE_ENV=test and requires a URL elsewhere", () => {
    expect(parseServerEnv({ NODE_ENV: "test" }).DATABASE_URL).toBe("pglite:memory");
    expect(() => parseServerEnv({})).toThrow();
  });
});
