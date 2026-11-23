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

/** Keys the LLD-phase2 §15.5 table lists as current (struck-through rows are removed keys). */
function lldPhase2Keys(): string[] {
  const doc = readFileSync(join("docs", "LLD-phase2.md"), "utf8");
  const section = (doc.split(/^### §15\.5 .*$/m)[1] ?? "").split(/^#{2,3} /m)[0] ?? "";
  return section
    .split(/\r?\n/)
    .filter((row) => row.startsWith("|") && !row.includes("~~"))
    .flatMap((row) => keysInCell(row.split("|")[1] ?? ""));
}

/** `A_B_X` · `_Y` means A_B_X and A_B_Y (the table shortens keys sharing the NEXT_PUBLIC_ prefix). */
function keysInCell(cell: string): string[] {
  const tokens = [...cell.matchAll(/`([A-Z_]+)`/g)].map((m) => m[1] ?? "");
  const prefix = tokens[0]?.startsWith("NEXT_PUBLIC_") ? "NEXT_PUBLIC_" : "";
  return tokens.map((t) => (t.startsWith("_") ? prefix + t.slice(1) : t));
}

describe("config (G-04, LLD 0.5)", () => {
  const phase1Keys = ["NEXT_PUBLIC_DEALER_PHONE"];

  const envExample = () =>
    Object.fromEntries(
      readFileSync(".env.example", "utf8")
        .split(/\r?\n/)
        .filter((l) => l.includes("=") && !l.startsWith("#"))
        .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
    );

  it(".env.example lists the phase-1 keys plus the LLD-phase2 §15.5 keys", () => {
    const expected = [...new Set([...phase1Keys, ...lldPhase2Keys()])].sort();
    expect(expected.length).toBeGreaterThan(phase1Keys.length);
    expect(Object.keys(envExample()).sort()).toEqual(expected);
  });

  it(".env.example holds placeholders only, no real-looking secret", () => {
    const vars = envExample();
    expect(vars.CRON_SECRET).toMatch(/^replace-with/);
    expect(vars.IP_HASH_PEPPER).toMatch(/^replace-with/);
    expect(vars.DATABASE_URL).toMatch(/^pglite:/);
    expect(vars.DATABASE_URL_UNPOOLED).toBe("");
    for (const v of Object.values(vars)) expect(v).not.toMatch(/postgres(ql)?:\/\/[^/]*@/);
  });

  it("the removed demo keys are gone from .env.example and the client config (T-01b)", () => {
    const keys = Object.keys(envExample());
    expect(keys).not.toContain("NEXT_PUBLIC_DEMO_PASSWORD");
    expect(keys).not.toContain("NEXT_PUBLIC_APP_URL");
    const clientEnv = readFileSync(join("src", "config", "env.ts"), "utf8");
    expect(clientEnv).not.toMatch(/DEMO_PASSWORD|NEXT_PUBLIC_APP_URL/);
  });

  it("only src/config/env.ts and src/server/env.ts read process.env", () => {
    const readers = sources("src").filter((f) => readFileSync(f, "utf8").includes("process.env"));
    expect(readers.sort()).toEqual([
      join("src", "config", "env.ts"),
      join("src", "server", "env.ts"),
    ]);
  });
});

describe("env fallback", () => {
  const keys = ["NEXT_PUBLIC_DEALER_PHONE"] as const;

  async function load(nodeEnv: string) {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", nodeEnv);
    for (const k of keys) vi.stubEnv(k, undefined);
    return import("@/config/env");
  }

  afterEach(() => vi.unstubAllEnvs());

  it("falls back to the .env.example sample values outside production", async () => {
    const { env } = await load("development");
    expect(env.NEXT_PUBLIC_DEALER_PHONE).toBe("+91 44 0000 0000");
  });

  it("stays strict in production", async () => {
    await expect(load("production")).rejects.toThrow();
  });
});
