import type { Topic } from "@/data/access";
import { IDLE_MS, type ActivityTracker } from "./activity";

export const STAFF_TOPICS: Topic[] = ["session", "visits", "responses", "alerts", "audit", "users", "branches", "advisors"];
export const DEFAULT_POLL_SECONDS = 30;
const NO_POLL_PREFIXES = ["/f", "/privacy", "/sign-in"];

export interface PollerDeps {
  activity: ActivityTracker;
  pollSeconds: number;
  doc: Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">;
  getPathname(): string;
  hasStaffSession(): boolean;
}

export interface Poller {
  subscribe(listener: (topics: Topic[]) => void): () => void;
}

function isPublicPath(path: string): boolean {
  return NO_POLL_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

export function createPoller(deps: PollerDeps): Poller {
  const listeners = new Set<(topics: Topic[]) => void>();
  let timer: ReturnType<typeof setInterval> | null = null;
  let stopResume: (() => void) | null = null;

  const mayRefresh = (): boolean =>
    deps.doc.visibilityState === "visible" &&
    deps.activity.isInUse(IDLE_MS) &&
    !isPublicPath(deps.getPathname()) &&
    deps.hasStaffSession();
  const emit = (): void => {
    if (mayRefresh()) listeners.forEach((l) => { l([...STAFF_TOPICS]); });
  };
  const onVisibility = (): void => { emit(); };

  const start = (): void => {
    timer = setInterval(emit, deps.pollSeconds * 1000);
    deps.doc.addEventListener("visibilitychange", onVisibility);
    stopResume = deps.activity.onResume(emit);
  };
  const stop = (): void => {
    if (timer !== null) clearInterval(timer);
    timer = null;
    deps.doc.removeEventListener("visibilitychange", onVisibility);
    stopResume?.();
    stopResume = null;
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      if (listeners.size === 1) start();
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) stop();
      };
    },
  };
}
