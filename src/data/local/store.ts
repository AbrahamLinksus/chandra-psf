import type { Topic } from "@/data/access/result";
import { DbSchemas, SessionSchema } from "@/domain/schemas";
import type { ChangeBus } from "./bus";
import type { Clock, Db } from "./db";
import type { FaultSwitch } from "./fault";

export const KEY_PREFIX = "psf:v1:";
const SESSION_KEY = `${KEY_PREFIX}session`;
const LOCK_NAME = "psf-db";
const ALL_TOPICS: Topic[] = ["session", "visits", "responses", "alerts", "audit", "users"];

const TOPICS_OF: Record<string, Topic[]> = {
  meta: ALL_TOPICS,
  session: ["session"],
  users: ["users", "session"],
  advisors: ["visits"],
  jobCards: ["visits"],
  visits: ["visits"],
  responses: ["responses", "visits"],
  alerts: ["alerts", "responses"],
  audit: ["audit"],
};

/** Thrown inside `mutate` for a simulated fault or a storage failure (incl. quota). */
export class SaveFailed extends Error {
  constructor(message = "Couldn't save, try again") {
    super(message);
    this.name = "SaveFailed";
  }
}

export interface StoreDeps {
  storage: Storage;
  locks: LockManager | null;
  bus: ChangeBus;
  fault: FaultSwitch;
  clock: Clock;
  /** Builds the rebased seed `Db` for a load day (LLD 4 Runtime). */
  seeder: (now: Date) => Promise<Db>;
  win?: Pick<Window, "addEventListener" | "removeEventListener">;
}

function topicsOfKey(key: string): Topic[] {
  return TOPICS_OF[key] ?? ALL_TOPICS;
}

export class LocalStore {
  readonly fault: FaultSwitch;
  private seeding: Promise<void> | null = null;

  constructor(private readonly deps: StoreDeps) {
    this.fault = deps.fault;
    deps.win?.addEventListener("storage", this.onStorage);
  }

  private readonly onStorage = (e: Event): void => {
    const key = (e as StorageEvent).key;
    if (key === null) {
      this.deps.bus.emit(ALL_TOPICS);
      return;
    }
    if (key.startsWith(KEY_PREFIX)) this.deps.bus.emit(topicsOfKey(key.slice(KEY_PREFIX.length)));
  };

  /** Parse + zod-validate one collection. Collections are `[]` until seeded; `meta` throws. */
  read<K extends keyof Db>(k: K): Db[K] {
    const raw = this.deps.storage.getItem(KEY_PREFIX + k);
    if (raw === null) {
      if (k === "meta") throw new Error("Store is not seeded yet");
      return [] as unknown as Db[K];
    }
    return DbSchemas[k].parse(JSON.parse(raw)) as Db[K];
  }

  readSession(): { userId: string } | null {
    const raw = this.deps.storage.getItem(SESSION_KEY);
    if (raw === null) return null;
    try {
      return SessionSchema.parse(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  writeSession(userId: string | null): void {
    if (userId === null) this.deps.storage.removeItem(SESSION_KEY);
    else this.deps.storage.setItem(SESSION_KEY, JSON.stringify({ userId }));
    this.deps.bus.emit(["session"]);
  }

  /** Resolves when the store holds a seeded database. Repositories await this first. */
  whenReady(): Promise<void> {
    return this.ensureSeeded(this.deps.clock.now());
  }

  ensureSeeded(now: Date): Promise<void> {
    this.seeding ??= this.locked(async () => {
      if (this.deps.storage.getItem(`${KEY_PREFIX}meta`) === null) {
        this.writeSeed(await this.deps.seeder(now));
      }
    }).catch((e: unknown) => {
      this.seeding = null;
      throw e;
    });
    return this.seeding;
  }

  async wipeAndReseed(now: Date): Promise<void> {
    await this.locked(async () => {
      const db = await this.deps.seeder(now);
      this.removeAll();
      this.writeSeed(db);
    });
    this.seeding = Promise.resolve();
    this.deps.bus.emit(ALL_TOPICS);
  }

  /** Lock → fault check → fresh read → fn → write changed keys → emit (LLD 3.2). */
  async mutate<K extends keyof Db, T>(keys: K[], fn: (draft: Pick<Db, K>) => T): Promise<T> {
    await this.whenReady();
    return this.locked(() => this.apply(keys, fn));
  }

  private apply<K extends keyof Db, T>(keys: K[], fn: (draft: Pick<Db, K>) => T): T {
    if (this.deps.fault.consume()) throw new SaveFailed("Simulated failed save");
    const before = new Map<K, string | null>();
    const draft: Partial<Db> = {};
    for (const k of keys) {
      before.set(k, this.deps.storage.getItem(KEY_PREFIX + k));
      Object.assign(draft, { [k]: this.read(k) });
    }
    const result = fn(draft as Pick<Db, K>);
    const changed = this.writeChanged(keys, draft, before);
    if (changed.length > 0) this.deps.bus.emit([...new Set(changed.flatMap(topicsOfKey))]);
    return result;
  }

  private writeChanged<K extends keyof Db>(keys: K[], draft: Partial<Db>, before: Map<K, string | null>): K[] {
    const next = keys.map((k) => [k, JSON.stringify(DbSchemas[k].parse(draft[k]))] as const);
    const changed = next.filter(([k, json]) => json !== before.get(k));
    const written: K[] = [];
    try {
      for (const [k, json] of changed) {
        this.deps.storage.setItem(KEY_PREFIX + k, json);
        written.push(k);
      }
    } catch {
      for (const k of written) this.restore(k, before.get(k) ?? null);
      throw new SaveFailed();
    }
    return changed.map(([k]) => k);
  }

  private restore(k: keyof Db, value: string | null): void {
    if (value === null) this.deps.storage.removeItem(KEY_PREFIX + k);
    else this.deps.storage.setItem(KEY_PREFIX + k, value);
  }

  /** Collections first, `meta` last, so a failed write never leaves a store that looks seeded. */
  private writeSeed(db: Db): void {
    const keys = (Object.keys(DbSchemas) as (keyof Db)[]).filter((k) => k !== "meta");
    for (const k of [...keys, "meta" as const]) {
      this.deps.storage.setItem(KEY_PREFIX + k, JSON.stringify(DbSchemas[k].parse(db[k])));
    }
    this.deps.bus.emit(ALL_TOPICS);
  }

  /** Removes every `psf:` key (collections, session, drafts). */
  private removeAll(): void {
    const keys: string[] = [];
    for (let i = 0; i < this.deps.storage.length; i++) {
      const key = this.deps.storage.key(i);
      if (key?.startsWith("psf:") === true) keys.push(key);
    }
    for (const key of keys) this.deps.storage.removeItem(key);
  }

  private async locked<T>(fn: () => Promise<T> | T): Promise<T> {
    const run = async (): Promise<T> => fn();
    if (this.deps.locks === null) return run();
    return await this.deps.locks.request(LOCK_NAME, run);
  }
}
