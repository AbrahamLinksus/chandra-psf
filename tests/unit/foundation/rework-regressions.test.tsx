import { cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Browser, FIXED_NOW, MemoryStorage, fixedClock } from "../../support";
import { PasswordPromptDialog } from "@/components/shared/PasswordPromptDialog";
import { PlaceholderScreen } from "@/components/shared/PlaceholderScreen";
import type { Db } from "@/data/local/db";
import { ChangeBus } from "@/data/local/bus";
import { FaultSwitch } from "@/data/local/fault";
import { decodeToken, encodeToken } from "@/data/local/repos/token";
import { LocalStore } from "@/data/local/store";
import { reconcileAlert } from "@/domain/alertRules";
import type { Alert } from "@/domain/types";
import { useFiltersFromUrl } from "@/hooks/useFiltersFromUrl";

const nav = vi.hoisted(() => ({ search: "" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/admin/responses",
  useSearchParams: () => new URLSearchParams(nav.search),
}));

afterEach(cleanup);

/** Real seed Db taken from a working tab, so schemas validate. */
async function realDb(): Promise<Db> {
  const tab = new Browser().openTab();
  await tab.store.whenReady();
  const db = {} as Record<string, unknown>;
  for (const k of allKeys(tab.storage)) db[k] = tab.store.read(k as keyof Db);
  return db as unknown as Db;
}

function allKeys(s: MemoryStorage): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i);
    if (k?.startsWith("psf:v1:") === true && k !== "psf:v1:session") out.push(k.slice(7));
  }
  return out;
}

class SpyStorage extends MemoryStorage {
  writes: string[] = [];
  failOn: string | null = null;
  override setItem(key: string, value: string): void {
    if (key === this.failOn) throw new Error("quota");
    this.writes.push(key);
    super.setItem(key, value);
  }
}

function storeWith(storage: Storage, seeder: () => Promise<Db>): LocalStore {
  return new LocalStore({
    storage,
    locks: null,
    bus: new ChangeBus(),
    fault: new FaultSwitch(new MemoryStorage()),
    clock: fixedClock(),
    seeder,
  });
}

describe("store seeding order (rework 1)", () => {
  it("writes meta last", async () => {
    const db = await realDb();
    const storage = new SpyStorage();
    await storeWith(storage, () => Promise.resolve(db)).whenReady();
    expect(storage.writes.length).toBeGreaterThan(1);
    expect(storage.writes.at(-1)).toBe("psf:v1:meta");
    expect(storage.writes.filter((k) => k === "psf:v1:meta")).toHaveLength(1);
  });

  it("a failure mid-seed leaves no meta and the next start re-seeds", async () => {
    const db = await realDb();
    const storage = new SpyStorage();
    storage.failOn = "psf:v1:users";
    const store = storeWith(storage, () => Promise.resolve(db));
    await expect(store.whenReady()).rejects.toThrow("quota");
    expect(storage.getItem("psf:v1:meta")).toBeNull();
    storage.failOn = null;
    await storeWith(storage, () => Promise.resolve(db)).whenReady();
    expect(storage.getItem("psf:v1:meta")).not.toBeNull();
    expect(storage.getItem("psf:v1:users")).not.toBeNull();
  });

  it("wipeAndReseed with a failing seeder leaves existing data intact", async () => {
    const browser = new Browser();
    const tab = browser.openTab();
    await tab.store.whenReady();
    const before = tab.store.read("users");
    const broken = storeWith(tab.storage, () => Promise.reject(new Error("seed boom")));
    await expect(broken.wipeAndReseed(FIXED_NOW)).rejects.toThrow("seed boom");
    expect(tab.store.read("users")).toEqual(before);
    expect(tab.storage.getItem("psf:v1:meta")).not.toBeNull();
  });
});

describe("token dates (rework 2)", () => {
  const visit = {
    id: "v-1",
    jobCardNo: "JC-24-1042",
    createdAt: "2026-03-10T06:30:00.000Z",
    expiresAt: "2026-03-17T06:30:00.000Z",
    phone: null,
  };
  it("rejects an invalid created date", () => {
    expect(decodeToken(encodeToken({ ...visit, createdAt: "not-a-date" }))).toBeNull();
  });
  it("rejects an invalid expiry date", () => {
    expect(decodeToken(encodeToken({ ...visit, expiresAt: "tomorrow-ish" }))).toBeNull();
  });
});

describe("reconcileAlert (rework 3)", () => {
  const now = new Date("2026-03-10T06:30:00.000Z");
  it("throws RangeError when creating without ids", () => {
    expect(() => reconcileAlert(null, [{ kind: "callback" }], now)).toThrow(RangeError);
  });
  it("existing already-resolved alert whose reasons vanish returns {existing, none}", () => {
    const resolved: Alert = {
      id: "al-1",
      responseId: "r-1",
      reasons: [{ kind: "callback" }],
      status: "resolved",
      notes: [],
      createdAt: "2026-03-09T06:30:00.000Z",
      updatedAt: "2026-03-09T06:30:00.000Z",
    };
    const r = reconcileAlert(resolved, [], now);
    expect(r).toEqual({ alert: resolved, change: "none" });
    expect(r.alert).toBe(resolved);
  });
});

describe("useFiltersFromUrl malformed dates (rework)", () => {
  it("falls back to the default range when from/to are malformed", () => {
    nav.search = "from=garbage&to=2026-13";
    const { result } = renderHook(() => useFiltersFromUrl());
    const { from, to } = result.current.filters;
    expect(to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(to).not.toBe("2026-13");
    expect(Date.parse(to) - Date.parse(from)).toBe(30 * 86_400_000);
    nav.search = "";
  });
});

describe("PlaceholderScreen showDemoLabel", () => {
  it("shows no badge by default and one with showDemoLabel", () => {
    const { unmount } = render(<PlaceholderScreen title="Alerts" />);
    expect(screen.queryByText(/Demo — sample data/)).toBeNull();
    unmount();
    render(<PlaceholderScreen title="Sign in" showDemoLabel />);
    expect(screen.getAllByText(/Demo — sample data/)).toHaveLength(1);
  });
});

describe("PasswordPromptDialog busy reset", () => {
  it("re-enables the button when onConfirm rejects", async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error("boom"));
    // The rejection surfaces as an unhandled rejection from the submit handler; swallow it here.
    const swallow = vi.fn();
    process.on("unhandledRejection", swallow);
    render(<PasswordPromptDialog open title="Confirm" onConfirm={onConfirm} onClose={vi.fn()} />);
    const button = screen.getByRole("button", { name: /confirm|delete|save|submit|continue/i });
    fireEvent.change(document.querySelector("input") as HTMLInputElement, {
      target: { value: "pw" },
    });
    fireEvent.click(button);
    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith("pw");
    });
    await waitFor(() => {
      expect((button as HTMLButtonElement).disabled).toBe(false);
    });
    process.off("unhandledRejection", swallow);
  });
});
