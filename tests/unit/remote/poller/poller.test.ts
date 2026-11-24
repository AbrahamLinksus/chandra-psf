import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createActivityTracker, ACTIVE_HEADER_MS, IDLE_MS } from "@/data/remote/activity";
import { createPoller, STAFF_TOPICS } from "@/data/remote/poller";
import { createRemoteDataAccess } from "@/data/remote/createRemoteDataAccess";

const POLL = 30;

function setup(opts: { path?: string; session?: boolean } = {}) {
  const target = new EventTarget();
  const vis: { visibilityState: DocumentVisibilityState } = { visibilityState: "visible" };
  const doc = Object.assign(new EventTarget(), vis);
  const activity = createActivityTracker({ target });
  const state = { path: opts.path ?? "/admin", session: opts.session ?? true };
  const poller = createPoller({
    activity,
    pollSeconds: POLL,
    doc,
    getPathname: () => state.path,
    hasStaffSession: () => state.session,
  });
  // "request counter": every emitted refresh is one round of requests
  const requests = vi.fn();
  const unsub = poller.subscribe(requests);
  const input = (): void => {
    target.dispatchEvent(new Event("keydown"));
  };
  const show = (v: DocumentVisibilityState): void => {
    doc.visibilityState = v;
    doc.dispatchEvent(new Event("visibilitychange"));
  };
  return { requests, unsub, input, show, state, activity };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("poller: when it refreshes", () => {
  it("test_s23 overnight tab: polls while in use, then stops after 15 min idle and while hidden", () => {
    const t = setup();
    vi.advanceTimersByTime(POLL * 1000 * 2);
    expect(t.requests).toHaveBeenCalledTimes(2);
    expect(t.requests).toHaveBeenLastCalledWith(STAFF_TOPICS);

    // idle beyond 15 min: the ticks up to the limit fire, after that none
    vi.advanceTimersByTime(IDLE_MS + 1000);
    const afterIdle = t.requests.mock.calls.length;
    vi.advanceTimersByTime(8 * 60 * 60 * 1000); // the night
    expect(t.requests).toHaveBeenCalledTimes(afterIdle);
  });

  it("s23 hidden tab makes no requests even with recent input", () => {
    const t = setup();
    t.show("hidden");
    t.requests.mockClear();
    vi.advanceTimersByTime(POLL * 1000 * 5);
    expect(t.requests).not.toHaveBeenCalled();
  });
});

describe("poller: cadence", () => {
  it("refreshes every POLL_SECONDS with all staff topics for a visible active tab", () => {
    const t = setup();
    vi.advanceTimersByTime(POLL * 1000 - 1);
    expect(t.requests).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(t.requests).toHaveBeenCalledTimes(1);
    expect(t.requests.mock.calls[0]?.[0]).toEqual([
      "session",
      "visits",
      "responses",
      "alerts",
      "audit",
      "users",
      "branches",
      "advisors",
    ]);
  });

  it("stops the timer when the last subscriber leaves", () => {
    const t = setup();
    t.unsub();
    vi.advanceTimersByTime(POLL * 1000 * 3);
    expect(t.requests).not.toHaveBeenCalled();
  });
});

describe("poller: resume", () => {
  it("returning to the tab refreshes once at once", () => {
    const t = setup();
    t.show("hidden");
    t.show("visible");
    expect(t.requests).toHaveBeenCalledTimes(1);
  });

  it("hiding the tab does not refresh", () => {
    const t = setup();
    t.show("hidden");
    expect(t.requests).not.toHaveBeenCalled();
  });

  it("the first input after more than 15 min idle refreshes once, later inputs do not", () => {
    const t = setup();
    vi.advanceTimersByTime(IDLE_MS + 60_000);
    t.requests.mockClear();
    t.input();
    expect(t.requests).toHaveBeenCalledTimes(1);
    t.input();
    t.input();
    expect(t.requests).toHaveBeenCalledTimes(1);
  });
});

describe("poller: where it never runs", () => {
  it.each(["/f/abc123", "/f", "/privacy", "/sign-in"])("no polling on %s", (path) => {
    const t = setup({ path });
    vi.advanceTimersByTime(POLL * 1000 * 4);
    t.show("hidden");
    t.show("visible");
    expect(t.requests).not.toHaveBeenCalled();
  });

  it("polls on a path that merely starts with the same letters (/feedback-admin)", () => {
    const t = setup({ path: "/fleet" });
    vi.advanceTimersByTime(POLL * 1000);
    expect(t.requests).toHaveBeenCalledTimes(1);
  });

  it("no polling without a staff session, and starts once there is one", () => {
    const t = setup({ session: false });
    vi.advanceTimersByTime(POLL * 1000 * 3);
    expect(t.requests).not.toHaveBeenCalled();
    t.state.session = true;
    vi.advanceTimersByTime(POLL * 1000);
    expect(t.requests).toHaveBeenCalledTimes(1);
  });
});

describe("x-psf-active header", () => {
  it("is 1 only within 60 s of input", async () => {
    const target = new EventTarget();
    const activity = createActivityTracker({ target });
    const fetchMock = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({ ok: true, value: 1 }))),
      );
    const da = createRemoteDataAccess({
      fetch: fetchMock,
      activity,
      poller: { subscribe: () => () => undefined },
      onUnauthenticated: vi.fn(),
    });
    const header = (): string =>
      ((fetchMock.mock.calls.at(-1) as [string, RequestInit])[1].headers as Record<string, string>)[
        "x-psf-active"
      ] ?? "";

    await da.auth.currentUser();
    expect(header()).toBe("0");
    target.dispatchEvent(new Event("pointerdown"));
    await da.auth.currentUser();
    expect(header()).toBe("1");
    vi.advanceTimersByTime(ACTIVE_HEADER_MS);
    await da.auth.currentUser();
    expect(header()).toBe("1");
    vi.advanceTimersByTime(1);
    await da.auth.currentUser();
    expect(header()).toBe("0");
  });

  it("dispose stops tracking input", () => {
    const target = new EventTarget();
    const activity = createActivityTracker({ target });
    vi.advanceTimersByTime(ACTIVE_HEADER_MS + 1);
    activity.dispose();
    target.dispatchEvent(new Event("keydown"));
    expect(activity.isActive()).toBe(false);
  });
});
