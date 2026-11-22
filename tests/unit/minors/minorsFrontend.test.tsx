import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { err, ok, type DataAccess } from "@/data/access";
import { DataAccessProvider } from "@/data/access/provider";
import type { User } from "@/domain/types";
import { useUserList } from "@/features/admin-users/useUserList";
import { useSetPassword } from "@/features/auth/useSetPassword";
import { clampText } from "@/features/feedback-form/TextField";
import { useLinkActions } from "@/features/support/useLinkActions";
import type { VisitSummary } from "@/data/access";

const nav = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: nav.replace }) }));

const session = vi.hoisted(() => ({ user: null as Partial<User> | null }));
vi.mock("@/hooks/useSession", () => ({
  SESSION_KEY: ["session"] as const,
  useSession: () => ({ user: session.user, isLoading: false }),
}));

beforeEach(() => {
  nav.replace.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function wrap(da: unknown) {
  const client = new QueryClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <DataAccessProvider value={da as DataAccess}>{children}</DataAccessProvider>
      </QueryClientProvider>
    );
  };
}

describe("set-password redirect follows the role (minor 2)", () => {
  it.each([
    ["admin", "/admin"],
    ["support", "/support"],
  ])("a %s lands on %s", async (role, path) => {
    session.user = { id: "u", role: role as User["role"], mustSetPassword: true };
    const da = { auth: { setOwnPassword: vi.fn(() => Promise.resolve(ok(undefined))) } };
    const { result } = renderHook(() => useSetPassword(), { wrapper: wrap(da) });
    await act(async () => {
      await result.current.submit("Demo@2026x", "Demo@2026x");
    });
    expect(nav.replace).toHaveBeenLastCalledWith(path);
  });
});

describe("clampText without Intl.Segmenter (minor 3)", () => {
  it("falls back to code points and still never splits an emoji", () => {
    vi.stubGlobal("Intl", { ...Intl, Segmenter: undefined });
    expect(clampText("a".repeat(999) + "😀", 1000)).toBe("a".repeat(999));
    expect(clampText("abc", 2)).toBe("ab");
  });
});

describe("copy flash timer (minor 5)", () => {
  it("is cleared on unmount", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("navigator", { clipboard: { writeText: () => Promise.resolve() } });
    session.user = { id: "u", role: "support" };
    const visit = { id: "v", url: "http://x", isMine: true } as VisitSummary;
    const { result, unmount } = renderHook(() => useLinkActions(visit, vi.fn()), {
      wrapper: wrap({}),
    });
    await act(async () => {
      result.current.copy();
      await Promise.resolve();
    });
    expect(result.current.copied).toBe("Copied");
    const spy = vi.spyOn(globalThis, "clearTimeout");
    unmount();
    expect(spy).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("Retry after a failed reactivate re-applies it (minor 9)", () => {
  it("calls setUserActive again with the same change", async () => {
    session.user = { id: "u-admin", role: "admin" };
    const target = { id: "u-2", name: "Deepa" } as User;
    const setUserActive = vi
      .fn()
      .mockResolvedValueOnce(err("SAVE_FAILED", "no"))
      .mockResolvedValue(ok(undefined));
    const da = { users: { listUsers: () => Promise.resolve(ok([])), setUserActive } };
    const { result } = renderHook(() => useUserList(), { wrapper: wrap(da) });
    act(() => {
      result.current.request(target, true);
    });
    await waitFor(() => {
      expect(result.current.mutation.status).toBe("error");
    });
    act(() => {
      result.current.retry();
    });
    await waitFor(() => {
      expect(setUserActive).toHaveBeenCalledTimes(2);
    });
    expect(setUserActive).toHaveBeenLastCalledWith("u-2", true);
  });
});
