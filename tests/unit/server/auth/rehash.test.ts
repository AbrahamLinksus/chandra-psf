// @vitest-environment node
import { eq } from "drizzle-orm";
import { hash, verify } from "@node-rs/argon2";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { users } from "@/server/db/schema";
import { makeServerCtx, must } from "../../../support/serverCtx";

vi.mock("server-only", () => ({}));
vi.mock("@/server/auth/password", async (orig) => {
  const real = await orig<typeof import("@/server/auth/password")>();
  return { ...real, hashPassword: vi.fn(real.hashPassword) };
});

const { ServerAuthRepo } = await import("@/server/repos/auth");
const pw = await import("@/server/auth/password");

const PW = "Correct-Horse-9";
const EMAIL = "asha@chandrahonda.in";
const OLD = { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;
const NEW_PREFIX = "$argon2id$v=19$m=19456,t=8,p=1$";
type Env = Awaited<ReturnType<typeof makeServerCtx>>;
let env: Env;
let repo: InstanceType<typeof ServerAuthRepo>;
let oldHash = "";
let newHash = "";

beforeEach(async () => {
  vi.mocked(pw.hashPassword).mockClear();
  env = await makeServerCtx();
  repo = new ServerAuthRepo(env.ctx);
  if (oldHash === "") {
    oldHash = await hash(PW, OLD);
    newHash = await pw.hashPassword(PW);
  }
  vi.mocked(pw.hashPassword).mockClear();
});
afterEach(async () => {
  await env.client.close();
});

async function seed(passwordHash: string): Promise<string> {
  const [row] = await env.db
    .insert(users)
    .values({ name: "Asha", email: EMAIL, passwordHash, role: "main_admin", branchId: null })
    .returning();
  return must(row).id;
}
async function storedHash(id: string): Promise<string> {
  const [u] = await env.db.select().from(users).where(eq(users.id, id));
  return must(u).passwordHash;
}

describe("argon2 parameters (D-29)", () => {
  it("new hashes carry m=19456,t=8,p=1 and verify", async () => {
    expect(newHash.startsWith(NEW_PREFIX)).toBe(true);
    expect(await verify(newHash, PW)).toBe(true);
  });
  it("DUMMY_HASH uses the current params; needsRehash tells old from current", () => {
    expect(pw.DUMMY_HASH.startsWith(NEW_PREFIX)).toBe(true);
    expect(pw.needsRehash(oldHash)).toBe(true);
    expect(pw.needsRehash(newHash)).toBe(false);
  });
});

describe("re-hash on sign-in", () => {
  it("verifies an old-param hash and replaces it with a current-param one", async () => {
    const id = await seed(oldHash);
    expect((await repo.signIn(EMAIL, PW)).ok).toBe(true);
    const stored = await storedHash(id);
    expect(stored.startsWith(NEW_PREFIX)).toBe(true);
    expect(await verify(stored, PW)).toBe(true);
    expect((await repo.signIn(EMAIL, PW)).ok).toBe(true);
  });
  it("does not re-write a current-param hash", async () => {
    const id = await seed(newHash);
    expect((await repo.signIn(EMAIL, PW)).ok).toBe(true);
    expect(pw.hashPassword).not.toHaveBeenCalled();
    expect(await storedHash(id)).toBe(newHash);
  });
  it("never re-hashes for a wrong password or an unknown email", async () => {
    const id = await seed(oldHash);
    expect((await repo.signIn(EMAIL, "wrong-pass-1")).ok).toBe(false);
    expect((await repo.signIn("nobody@chandrahonda.in", PW)).ok).toBe(false);
    expect(pw.hashPassword).not.toHaveBeenCalled();
    expect(await storedHash(id)).toBe(oldHash);
  });
  it("a re-hash failure does not fail the sign-in and keeps the old hash", async () => {
    const id = await seed(oldHash);
    vi.mocked(pw.hashPassword).mockRejectedValueOnce(new Error("boom"));
    expect((await repo.signIn(EMAIL, PW)).ok).toBe(true);
    expect(await storedHash(id)).toBe(oldHash);
  });
});

describe("re-hash race", () => {
  it("a hash changed between verify and re-hash survives (conditional write)", async () => {
    const id = await seed(oldHash);
    const other = await hash("Another-Pass-42", OLD);
    const real =
      await vi.importActual<typeof import("@/server/auth/password")>("@/server/auth/password");
    vi.mocked(pw.hashPassword).mockImplementationOnce(async (p: string) => {
      // simulate a reset landing while the re-hash is computing
      await env.db.update(users).set({ passwordHash: other }).where(eq(users.id, id));
      return real.hashPassword(p);
    });
    expect((await repo.signIn(EMAIL, PW)).ok).toBe(true);
    expect(await storedHash(id)).toBe(other);
  });
});

describe("AUTH_HASH_TIMING log", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });
  it("writes one ms-only JSON line per operation when the flag is 1", async () => {
    vi.stubEnv("AUTH_HASH_TIMING", "1");
    const out = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const real =
      await vi.importActual<typeof import("@/server/auth/password")>("@/server/auth/password");
    const h = await real.hashPassword("Secret-Pass-77");
    await real.verifyPassword(h, "Secret-Pass-77");
    const lines = out.mock.calls.map((c) => String(c[0]));
    expect(lines).toHaveLength(2);
    const parsed = lines.map((l) => JSON.parse(l) as Record<string, unknown>);
    expect(parsed.map((p) => p.op)).toEqual(["hash", "verify"]);
    for (const p of parsed) {
      expect(Object.keys(p).sort()).toEqual(["evt", "ms", "op"]);
      expect(typeof p.ms).toBe("number");
    }
    expect(lines.join("")).not.toMatch(/Secret-Pass|argon2|@/);
  });
  it("writes nothing when the flag is off", async () => {
    vi.stubEnv("AUTH_HASH_TIMING", "");
    const out = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const real =
      await vi.importActual<typeof import("@/server/auth/password")>("@/server/auth/password");
    await real.verifyPassword(newHash, PW);
    expect(out).not.toHaveBeenCalled();
  });
});
