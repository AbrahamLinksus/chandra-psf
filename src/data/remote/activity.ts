export const ACTIVE_HEADER_MS = 60_000;
export const IDLE_MS = 15 * 60_000;

export interface ActivityTracker {
  /** True only when a real input happened within `withinMs` (default 60 s: the `x-psf-active` header). */
  isActive(withinMs?: number): boolean;
  /** True when the screen is in use: input within `withinMs` (default 15 min), page load counting as use. */
  isInUse(withinMs?: number): boolean;
  /** Called on the first input after more than `IDLE_MS` without any. Returns an unsubscribe. */
  onResume(listener: () => void): () => void;
  dispose(): void;
}

export interface ActivityDeps {
  target: Pick<EventTarget, "addEventListener" | "removeEventListener">;
  now?: () => number;
}

const INPUT_EVENTS = ["pointerdown", "keydown", "scroll"] as const;

export function createActivityTracker(deps: ActivityDeps): ActivityTracker {
  const now = deps.now ?? Date.now;
  const loadedAt = now();
  let lastInputAt: number | null = null;
  const resumeListeners = new Set<() => void>();
  const handler = (): void => {
    const t = now();
    const wasIdle = t - (lastInputAt ?? loadedAt) > IDLE_MS;
    lastInputAt = t;
    if (wasIdle) resumeListeners.forEach((l) => { l(); });
  };
  INPUT_EVENTS.forEach((e) => { deps.target.addEventListener(e, handler, { passive: true }); });
  return {
    isActive: (withinMs = ACTIVE_HEADER_MS) => lastInputAt !== null && now() - lastInputAt <= withinMs,
    isInUse: (withinMs = IDLE_MS) => now() - (lastInputAt ?? loadedAt) <= withinMs,
    onResume(listener) {
      resumeListeners.add(listener);
      return () => void resumeListeners.delete(listener);
    },
    dispose() {
      INPUT_EVENTS.forEach((e) => { deps.target.removeEventListener(e, handler); });
      resumeListeners.clear();
    },
  };
}
