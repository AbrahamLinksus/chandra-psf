// @vitest-environment node
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../../../..");
const CONFIG = join(ROOT, ".dependency-cruiser.cjs");
const DEPCRUISE = join(ROOT, "node_modules/.bin/depcruise");

/** Plants `files` in a scratch src/ and runs the project's depcruise rules there. Returns violated rule names. */
function violations(files: Record<string, string>): string[] {
  const dir = mkdtempSync(join(tmpdir(), "layers-"));
  try {
    copyFileSync(join(ROOT, "tsconfig.json"), join(dir, "tsconfig.json"));
    for (const [p, body] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, p)), { recursive: true });
      writeFileSync(join(dir, p), body);
    }
    let stdout: string;
    try {
      stdout = execFileSync(DEPCRUISE, ["src", "--config", CONFIG, "--output-type", "json"], {
        cwd: dir,
        stdio: ["ignore", "pipe", "pipe"],
        maxBuffer: 10_000_000,
      }).toString();
    } catch (e) {
      stdout = String((e as { stdout: Buffer }).stdout);
    }
    const out = JSON.parse(stdout) as { summary: { violations: { rule: { name: string } }[] } };
    return out.summary.violations.map((v) => v.rule.name);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("LLD 15.3 layer rules fail on a planted violation", () => {
  it("server-hidden: a feature importing src/server", () => {
    const v = violations({
      "src/server/a.ts": "export const a = 1;\n",
      "src/features/f/x.ts": 'import { a } from "../../server/a";\nexport const b = a;\n',
    });
    expect(v).toContain("server-hidden");
  });

  it("server-no-ui: the server importing a component", () => {
    const v = violations({
      "src/components/c.ts": "export const c = 1;\n",
      "src/server/a.ts": 'import { c } from "../components/c";\nexport const a = c;\n',
    });
    expect(v).toContain("server-no-ui");
  });

  it("remote-hidden: a feature importing src/data/remote", () => {
    const v = violations({
      "src/data/remote/r.ts": "export const r = 1;\n",
      "src/features/f/x.ts": 'import { r } from "../../data/remote/r";\nexport const b = r;\n',
    });
    expect(v).toContain("remote-hidden");
  });

  it("repos-via-root: code outside the composition root importing src/server/repos", () => {
    const v = violations({
      "src/server/repos/a.ts": "export const a = 1;\n",
      "src/server/other.ts": 'import { a } from "./repos/a";\nexport const b = a;\n',
    });
    expect(v).toContain("repos-via-root");
  });

  it("allows the composition root to import repos", () => {
    const v = violations({
      "src/server/repos/a.ts": "export const a = 1;\n",
      "src/server/createServerDataAccess.ts":
        'import { a } from "./repos/a";\nexport const b = a;\n',
    });
    expect(v).toEqual([]);
  });
});

describe("LLD 18.5 security headers", () => {
  it("next.config sets the four headers on every path", async () => {
    const cfg = (await import("../../../../next.config")).default;
    type Rules = { source: string; headers: { key: string; value: string }[] }[];
    const rules = await (cfg.headers as () => Promise<Rules>)();
    expect(rules[0]?.source).toBe("/:path*");
    const h = Object.fromEntries((rules[0]?.headers ?? []).map((x) => [x.key, x.value]));
    expect(h["Referrer-Policy"]).toBe("no-referrer");
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["Permissions-Policy"]).toContain("camera=()");
  });

  it("the route handler is dynamic and POST-only", () => {
    const src = readFileSync(join(ROOT, "src/app/api/rpc/[repo]/[method]/route.ts"), "utf8");
    expect(src).toContain('dynamic = "force-dynamic"');
    expect(src).not.toMatch(/export (async )?function (GET|PUT|DELETE)/);
  });
});
