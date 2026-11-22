import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sources(p);
    return /\.(ts|tsx)$/.test(name) ? [p] : [];
  });
}

describe("config (G-04, LLD 0.5)", () => {
  it(".env.example lists exactly the three LLD 0.5 keys", () => {
    const keys = readFileSync(".env.example", "utf8")
      .split(/\r?\n/)
      .filter((l) => l.includes("=") && !l.startsWith("#"))
      .map((l) => l.split("=")[0]);
    expect(keys.sort()).toEqual([
      "NEXT_PUBLIC_APP_URL",
      "NEXT_PUBLIC_DEALER_PHONE",
      "NEXT_PUBLIC_DEMO_PASSWORD",
    ]);
  });

  it("only src/config/env.ts reads process.env", () => {
    const readers = sources("src").filter((f) => readFileSync(f, "utf8").includes("process.env"));
    expect(readers).toEqual([join("src", "config", "env.ts")]);
  });
});

describe("env fallback", () => {
  const keys = [
    "NEXT_PUBLIC_DEMO_PASSWORD",
    "NEXT_PUBLIC_APP_URL",
    "NEXT_PUBLIC_DEALER_PHONE",
  ] as const;

  async function load(nodeEnv: string) {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", nodeEnv);
    for (const k of keys) vi.stubEnv(k, undefined);
    return import("@/config/env");
  }

  afterEach(() => vi.unstubAllEnvs());

  it("falls back to the .env.example sample values outside production", async () => {
    const { env } = await load("development");
    expect(env.NEXT_PUBLIC_DEMO_PASSWORD).toBe("Demo@2026");
    expect(env.NEXT_PUBLIC_APP_URL).toBe("");
    expect(env.NEXT_PUBLIC_DEALER_PHONE).toBe("+91 44 0000 0000");
  });

  it("stays strict in production", async () => {
    await expect(load("production")).rejects.toThrow();
  });
});
