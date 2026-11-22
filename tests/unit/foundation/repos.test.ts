import { describe, expect, it } from "vitest";
import { FIXED_NOW, MemoryStorage, fixedClock } from "../../support";
import type { DataAccess } from "@/data/access";
import { createLocalDataAccess } from "@/data/local/createLocalDataAccess";
import { env } from "@/config/env";
import { appendAudit } from "@/data/local/repos/auditWriter";

function make(search = ""): { da: DataAccess; storage: MemoryStorage } {
  window.sessionStorage.clear();
  window.history.replaceState({}, "", `/${search}`);
  const storage = new MemoryStorage();
  const da = createLocalDataAccess({ storage, locks: null, clock: fixedClock(), win: window });
  return { da, storage };
}

const noSession = { password: "x" };
const stubCalls: [string, (da: DataAccess) => Promise<unknown>][] = [
  [
    "responses.listResponses",
    (d) => d.responses.listResponses({ from: "2026-01-01", to: "2026-01-31" }),
  ],
  ["responses.getResponse", (d) => d.responses.getResponse("r")],
  ["responses.editResponse", (d) => d.responses.editResponse("r", {}, noSession)],
  ["responses.deleteResponse", (d) => d.responses.deleteResponse("r", noSession)],
  ["responses.restoreResponse", (d) => d.responses.restoreResponse("r", noSession)],
  ["responses.listDeleted", (d) => d.responses.listDeleted()],
  ["audit.listAudit", (d) => d.audit.listAudit()],
  ["users.listUsers", (d) => d.users.listUsers()],
  [
    "users.createSupportUser",
    (d) => d.users.createSupportUser({ name: "n", email: "e@x.y", tempPassword: "12345678" }),
  ],
  ["users.setUserActive", (d) => d.users.setUserActive("u", false)],
];

describe("LLD 2.2 repo methods (foundation stubs)", () => {
  it.each(stubCalls)("%s returns UNAVAILABLE 'Not built yet'", async (_name, call) => {
    const { da } = make();
    expect(await call(da)).toEqual({
      ok: false,
      error: { code: "UNAVAILABLE", message: "Not built yet" },
    });
  });

  it("every repo of the DataAccess exists, plus subscribe", () => {
    const { da } = make();
    for (const k of [
      "auth",
      "demo",
      "jobCards",
      "visits",
      "feedback",
      "analytics",
      "alerts",
      "responses",
      "audit",
      "users",
    ]) {
      expect(typeof (da as unknown as Record<string, unknown>)[k]).toBe("object");
    }
    expect(typeof da.subscribe).toBe("function");
  });
});

describe("createLocalDataAccess", () => {
  it("auth.currentUser is null without a session, the user with one, null when deactivated", async () => {
    const { da, storage } = make();
    expect(await da.auth.currentUser()).toEqual({ ok: true, value: null });
    storage.setItem("psf:v1:session", JSON.stringify({ userId: "u-admin" }));
    const r = await da.auth.currentUser();
    expect(r.ok && r.value?.role).toBe("admin");
    expect(r.ok && r.value && "passwordHash" in r.value).toBe(false);
    const users = JSON.parse(storage.getItem("psf:v1:users") ?? "[]") as {
      id: string;
      active: boolean;
    }[];
    storage.setItem(
      "psf:v1:users",
      JSON.stringify(users.map((u) => (u.id === "u-admin" ? { ...u, active: false } : u))),
    );
    expect(await da.auth.currentUser()).toEqual({ ok: true, value: null });
  });

  it("subscribe returns an unsubscribe function", () => {
    const { da } = make();
    const seen: unknown[] = [];
    const off = da.subscribe((t) => seen.push(t));
    off();
    expect(seen).toEqual([]);
  });

  it("?demoFail=1 arms the fault switch for this tab's next write", () => {
    make("?demoFail=1");
    expect(window.sessionStorage.getItem("psf:fault")).toBe("1");
  });

  it("without ?demoFail the fault switch stays off", () => {
    make();
    expect(window.sessionStorage.getItem("psf:fault")).toBeNull();
  });
});

describe("config and audit writer", () => {
  it("env exposes the three LLD 0.5 keys", () => {
    expect(env.NEXT_PUBLIC_DEMO_PASSWORD).toBe("Demo@2026");
    expect(env.NEXT_PUBLIC_APP_URL).toMatch(/^https?:\/\//);
    expect(env.NEXT_PUBLIC_DEALER_PHONE).not.toBe("");
  });

  it("appendAudit adds an entry with id and the given time", () => {
    const draft = { audit: [] as import("@/domain/types").AuditEntry[] };
    const e = appendAudit(
      draft,
      {
        actorId: "u",
        actorName: "U",
        action: "alert.note",
        entityType: "alert",
        entityId: "a",
        oldValue: null,
        newValue: "x",
      },
      FIXED_NOW,
    );
    expect(draft.audit).toEqual([e]);
    expect(e.at).toBe(FIXED_NOW.toISOString());
    expect(e.id).toMatch(/^a-/);
  });
});
