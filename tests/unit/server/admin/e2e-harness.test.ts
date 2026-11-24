// @vitest-environment node
/* eslint-disable max-lines-per-function -- describe blocks group several tests */
import { verify } from "@node-rs/argon2";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import globalSetup, { E2E_ADMIN, e2eDataDir } from "../../../e2e/global-setup";
import {
  E2E_ADMIN_NEW_PASSWORD,
  adminApi,
  adminCredentials,
  adminPasswordFiles,
} from "../../../support/e2e";
import { auditLog, users } from "../../../../src/server/db/schema";
import * as schema from "../../../../src/server/db/schema";

const ENV_KEYS = ["DATABASE_URL", "E2E_ADMIN_EMAIL", "E2E_ADMIN_PASSWORD"] as const;
const saved: Record<string, string | undefined> = {};
let tmp: string;

beforeEach(() => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  tmp = mkdtempSync(join(process.cwd(), ".pglite-test-harness-"));
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    const v = saved[k];
    if (v === undefined) Reflect.deleteProperty(process.env, k);
    else process.env[k] = v;
  }
  rmSync(tmp, { recursive: true, force: true });
});

describe("e2e globalSetup", () => {
  it("wipes a stale dir, migrates, inits the admin and exposes the credentials", async () => {
    const dir = join(tmp, "db");
    process.env["DATABASE_URL"] = `pglite:./${relative(process.cwd(), dir)}`;
    writeFileSync(`${dir}.admin-password-set`, "stale");
    writeFileSync(`${dir}.admin-password-lock`, "stale");
    await globalSetup();
    expect(existsSync(`${dir}.admin-password-set`)).toBe(false);
    expect(existsSync(`${dir}.admin-password-lock`)).toBe(false);
    const creds = adminCredentials();
    expect(creds.email).toBe(E2E_ADMIN.email);

    const client = new PGlite(dir);
    try {
      const db = drizzle(client, { schema });
      const [row] = await db.select().from(users).where(eq(users.email, E2E_ADMIN.email));
      expect(row?.mustSetPassword).toBe(true);
      expect(await verify(row?.passwordHash ?? "", creds.oneTimePassword)).toBe(true);
      const audit = await db.select().from(auditLog);
      expect(JSON.stringify(audit)).not.toContain(creds.oneTimePassword);
    } finally {
      await client.close();
    }
  }, 60_000);

  it("refuses a database URL that is not a pglite directory", async () => {
    process.env["DATABASE_URL"] = "postgres://x/y";
    await expect(globalSetup()).rejects.toThrow(/pglite directory/);
  });

  it("a non-numeric PORT makes setup refuse and delete nothing", async () => {
    const dir = join(tmp, "db");
    mkdirSync(dir);
    writeFileSync(join(dir, "keep"), "x");
    process.env["DATABASE_URL"] = `pglite:./${relative(process.cwd(), dir)}`;
    const savedPort = process.env["PORT"];
    process.env["PORT"] = "80; rm -rf ..";
    try {
      await expect(globalSetup()).rejects.toThrow(/PORT must be digits only/);
    } finally {
      if (savedPort === undefined) Reflect.deleteProperty(process.env, "PORT");
      else process.env["PORT"] = savedPort;
    }
    expect(existsSync(join(dir, "keep"))).toBe(true);
  });

  it("e2eDataDir refuses a directory outside the repo and accepts one inside", () => {
    const root = resolve("/repo");
    const env = { DATABASE_URL: "pglite:./../elsewhere" };
    expect(() => e2eDataDir(env, root)).toThrow(/outside the repo/);
    expect(() => e2eDataDir({ DATABASE_URL: "pglite:./." }, root)).toThrow(/outside the repo/);
    expect(e2eDataDir({ PORT: "8019", DATABASE_URL: "pglite:./.pglite-e2e-8019" }, root)).toBe(
      join(root, ".pglite-e2e-8019"),
    );
  });

  it("adminCredentials names the missing variable", () => {
    delete process.env["E2E_ADMIN_EMAIL"];
    expect(() => adminCredentials()).toThrow(/E2E_ADMIN_EMAIL is not set/);
  });
});

type Call = { path: string; args: unknown[] };

function fakePlaywright(
  respond: (path: string, args: unknown[]) => unknown,
  calls: Call[],
): Parameters<typeof adminApi>[0] {
  const request = {
    post: (path: string, opts: { data: { args: unknown[] } }) => {
      calls.push({ path, args: opts.data.args });
      return Promise.resolve({ json: () => Promise.resolve(respond(path, opts.data.args)) });
    },
  };
  return { request: { newContext: () => Promise.resolve(request) } } as unknown as Parameters<
    typeof adminApi
  >[0];
}

const OK = { ok: true, value: null };

describe("adminApi (one-time password replaced once per run)", () => {
  beforeEach(() => {
    process.env["DATABASE_URL"] = `pglite:./${relative(process.cwd(), join(tmp, "db"))}`;
    process.env["E2E_ADMIN_EMAIL"] = "a@e2e.test";
    process.env["E2E_ADMIN_PASSWORD"] = "one-time-pw";
  });

  it("with the marker present makes no one-time-password attempt", async () => {
    writeFileSync(adminPasswordFiles().marker, "done");
    const calls: Call[] = [];
    await adminApi(
      fakePlaywright(() => OK, calls),
      "http://localhost:8019",
    );
    expect(calls).toEqual([
      { path: "/api/rpc/auth/signIn", args: ["a@e2e.test", E2E_ADMIN_NEW_PASSWORD] },
    ]);
  });

  it("without the marker switches the password once, writes the marker and releases the lock", async () => {
    const calls: Call[] = [];
    await adminApi(
      fakePlaywright(() => OK, calls),
      "http://localhost:8019",
    );
    expect(calls.map((c) => c.path)).toEqual([
      "/api/rpc/auth/signIn",
      "/api/rpc/auth/setOwnPassword",
      "/api/rpc/auth/signIn",
    ]);
    expect(calls[0]?.args).toEqual(["a@e2e.test", "one-time-pw"]);
    const { marker, lock } = adminPasswordFiles();
    expect(existsSync(marker)).toBe(true);
    expect(existsSync(lock)).toBe(false);
  });

  it("rethrows errors other than UNAVAILABLE and does not mark the switch done", async () => {
    const calls: Call[] = [];
    const rate = { ok: false, error: { code: "RATE_LIMITED", message: "slow down" } };
    await expect(
      adminApi(
        fakePlaywright(() => rate, calls),
        "http://localhost:8019",
      ),
    ).rejects.toThrow(/RATE_LIMITED slow down/);
    expect(calls).toHaveLength(1);
    const { marker, lock } = adminPasswordFiles();
    expect(existsSync(marker)).toBe(false);
    expect(existsSync(lock)).toBe(false);
  });

  it("keeps the 'not available yet' error for UNAVAILABLE", async () => {
    const un = { ok: false, error: { code: "UNAVAILABLE", message: "x" } };
    await expect(
      adminApi(
        fakePlaywright(() => un, []),
        "http://localhost:8019",
      ),
    ).rejects.toThrow(/not available yet/);
  });

  it("makes a second worker wait for the lock holder, then sign in with the new password only", async () => {
    const { marker, lock } = adminPasswordFiles();
    writeFileSync(lock, "held");
    const calls: Call[] = [];
    const pending = adminApi(
      fakePlaywright(() => OK, calls),
      "http://localhost:8019",
    );
    await new Promise((r) => setTimeout(r, 350));
    expect(calls).toHaveLength(0); // still waiting
    writeFileSync(marker, "done");
    rmSync(lock);
    await pending;
    expect(calls).toEqual([
      { path: "/api/rpc/auth/signIn", args: ["a@e2e.test", E2E_ADMIN_NEW_PASSWORD] },
    ]);
  });
});
