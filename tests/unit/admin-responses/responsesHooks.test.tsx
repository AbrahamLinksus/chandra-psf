import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ok, type DataAccess } from "@/data/access";
import { DataAccessProvider } from "@/data/access/provider";
import { useDeleted } from "@/features/admin-responses/useDeleted";
import { useResponses } from "@/features/admin-responses/useResponses";

const nav = vi.hoisted(() => ({ search: "" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/admin/responses",
  useSearchParams: () => new URLSearchParams(nav.search),
}));

beforeEach(() => {
  nav.search = "";
});
afterEach(cleanup);

function fakeDa() {
  const responses = {
    listResponses: vi.fn(() => Promise.resolve(ok([]))),
    listDeleted: vi.fn(() => Promise.resolve(ok([]))),
    restoreResponse: vi.fn(() => Promise.resolve(ok(undefined))),
  };
  const analytics = { getFilterOptions: vi.fn(() => Promise.resolve(ok({}))) };
  return { responses, analytics };
}

function wrap(da: unknown) {
  const client = new QueryClient();
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <DataAccessProvider value={da as DataAccess}>{children}</DataAccessProvider>
      </QueryClientProvider>
    );
  }
  return Wrapper;
}

describe("useDeleted restore with nothing selected (rework)", () => {
  it("returns SAVE_FAILED and never calls the repo", async () => {
    const da = fakeDa();
    const { result } = renderHook(() => useDeleted(), { wrapper: wrap(da) });
    let r: Awaited<ReturnType<typeof result.current.restore>> | undefined;
    await act(async () => {
      r = await result.current.restore("Demo@2026");
    });
    expect(r?.ok).toBe(false);
    expect(!r?.ok && r?.error.code).toBe("SAVE_FAILED");
    expect(da.responses.restoreResponse).not.toHaveBeenCalled();
  });

  it("restores the selected id", async () => {
    const da = fakeDa();
    const { result } = renderHook(() => useDeleted(), { wrapper: wrap(da) });
    act(() => {
      result.current.ask("r-s020");
    });
    await act(async () => {
      await result.current.restore("Demo@2026");
    });
    expect(da.responses.restoreResponse).toHaveBeenCalledWith("r-s020", { password: "Demo@2026" });
  });
});

describe("useResponses date range (rework)", () => {
  it("lists the last 30 days by default", async () => {
    const da = fakeDa();
    renderHook(() => useResponses(), { wrapper: wrap(da) });
    await waitFor(() => {
      expect(da.responses.listResponses).toHaveBeenCalled();
    });
    const [filters] = da.responses.listResponses.mock.calls[0] as unknown as [
      { from: string; to: string },
    ];
    expect(Date.parse(filters.to) - Date.parse(filters.from)).toBe(30 * 86_400_000);
  });

  it("URL from/to override the default", async () => {
    nav.search = "from=2020-01-01&to=2020-02-01";
    const da = fakeDa();
    renderHook(() => useResponses(), { wrapper: wrap(da) });
    await waitFor(() => {
      expect(da.responses.listResponses).toHaveBeenCalledWith({
        from: "2020-01-01",
        to: "2020-02-01",
      });
    });
  });
});
