import "./env";
import seedJson from "@/data/seed/seed.json";
import { ChangeBus } from "@/data/local/bus";
import type { Clock } from "@/data/local/db";
import { FaultSwitch } from "@/data/local/fault";
import { rebaseSeed } from "@/data/local/seed";
import { LocalStore } from "@/data/local/store";
import { SeedSchema } from "@/domain/schemas";

/** In-memory Storage fake. `onWrite` lets a shared backend notify other tabs. */
export class MemoryStorage implements Storage {
  constructor(
    private readonly onWrite?: (key: string | null) => void,
    private readonly map: Map<string, string> = new Map(),
  ) {}
  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
    this.onWrite?.(null);
  }
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
    this.onWrite?.(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
    this.onWrite?.(key);
  }
}

export const FIXED_NOW = new Date("2026-03-10T06:30:00.000Z");

export function fixedClock(now: Date = FIXED_NOW): Clock {
  return { now: () => new Date(now) };
}

/** Minimal LockManager: serialises requests (enough for `navigator.locks.request`). */
export class FakeLocks {
  private tail: Promise<unknown> = Promise.resolve();
  asManager(): LockManager {
    const request = async (_name: string, cb: () => Promise<unknown>): Promise<unknown> => {
      const run = this.tail.then(() => cb());
      this.tail = run.catch(() => undefined);
      return run;
    };
    return { request } as unknown as LockManager;
  }
}

export interface Tab {
  store: LocalStore;
  /** This tab's view of the shared localStorage. */
  storage: MemoryStorage;
  bus: ChangeBus;
  win: EventTarget;
  fault: FaultSwitch;
  sessionStorage: MemoryStorage;
  /** Topic lists emitted on this tab's bus, in order. */
  events: string[][];
}

/** Shared "browser profile": one localStorage plus one lock manager, many tabs. */
export class Browser {
  readonly locks = new FakeLocks();
  private readonly tabs: Tab[] = [];
  private readonly data = new Map<string, string>();
  /** A view of the shared localStorage that tests can read or poke (fires no events). */
  readonly storage = new MemoryStorage(undefined, this.data);

  constructor(readonly clock: Clock = fixedClock()) {}

  /** A new tab (store instance) over the shared storage; its writes fire `storage` in the other tabs only. */
  openTab(): Tab {
    const bus = new ChangeBus();
    const win = new EventTarget();
    const sessionStorage = new MemoryStorage();
    const fault = new FaultSwitch(sessionStorage);
    const events: string[][] = [];
    bus.on((t) => events.push(t));
    const seeder = (now: Date) =>
      rebaseSeed(SeedSchema.parse(seedJson), now, process.env["NEXT_PUBLIC_DEMO_PASSWORD"] ?? "");
    const notifyOthers = (key: string | null): void => {
      for (const t of this.tabs) {
        if (t.win !== win) t.win.dispatchEvent(Object.assign(new Event("storage"), { key }));
      }
    };
    const storage = new MemoryStorage(notifyOthers, this.data);
    const store = new LocalStore({
      storage,
      locks: this.locks.asManager(),
      bus,
      fault,
      clock: this.clock,
      seeder,
      win: win,
    });
    const tab: Tab = { store, storage, bus, win, fault, sessionStorage, events };
    this.tabs.push(tab);
    return tab;
  }
}

/** Sets the session without the UI (user ids come from the seed). */
export function signInAs(tab: Tab, who: "admin" | "support1" | "support2"): void {
  tab.store.writeSession(`u-${who}`);
}

/** Wipes the demo data and reseeds, like the "Reset demo data" action. */
export async function resetDemo(tab: Tab, clock: Clock = fixedClock()): Promise<void> {
  await tab.store.wipeAndReseed(clock.now());
}

/** Another tab on the same browser profile (shares storage and locks). */
export function openSecondTab(browser: Browser): Tab {
  return browser.openTab();
}
