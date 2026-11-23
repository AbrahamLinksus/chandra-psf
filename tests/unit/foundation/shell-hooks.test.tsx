import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { err, ok, type DataAccess } from "@/data/access";
import { DataAccessProvider } from "@/data/access/provider";
import { useFiltersFromUrl } from "@/hooks/useFiltersFromUrl";
import { useShellActions } from "@/hooks/useShellActions";

const nav = vi.hoisted(() => ({ replace: vi.fn(), search: "" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace }),
  usePathname: () => "/admin/responses",
  useSearchParams: () => new URLSearchParams(nav.search),
}));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

beforeEach(() => {
  nav.replace.mockReset();
  nav.search = "";
  toast.error.mockReset();
  toast.success.mockReset();
});
afterEach(cleanup);

function wrapper(da: unknown) {
  const client = new QueryClient();
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <DataAccessProvider value={da as DataAccess}>{children}</DataAccessProvider>
    </QueryClientProvider>
  );
  return Wrapper;
}

describe("useFiltersFromUrl", () => {
  it("defaults to the last 30 days", () => {
    const { result } = renderHook(() => useFiltersFromUrl(), { wrapper: wrapper({}) });
    const { from, to } = result.current.filters;
    expect(Date.parse(to) - Date.parse(from)).toBe(30 * 86_400_000);
  });

  it("reads range, vehicle type, model and advisor from the query; ignores a bad vehicle type", () => {
    nav.search = "from=2026-01-01&to=2026-01-31&vehicleType=scooter&model=Activa&advisorId=a-1";
    const { result } = renderHook(() => useFiltersFromUrl(), { wrapper: wrapper({}) });
    expect(result.current.filters).toEqual({
      from: "2026-01-01",
      to: "2026-01-31",
      vehicleType: "scooter",
      model: "Activa",
      advisorId: "a-1",
    });
    nav.search = "vehicleType=truck";
    const bad = renderHook(() => useFiltersFromUrl(), { wrapper: wrapper({}) });
    expect(bad.result.current.filters.vehicleType).toBeUndefined();
  });

  it("setFilters writes the filters into the URL query", () => {
    const { result } = renderHook(() => useFiltersFromUrl(), { wrapper: wrapper({}) });
    result.current.setFilters({ from: "2026-01-01", to: "2026-01-31", model: "" });
    expect(nav.replace).toHaveBeenCalledWith("/admin/responses?from=2026-01-01&to=2026-01-31");
  });
});

describe("useShellActions", () => {
  function Buttons() {
    const a = useShellActions();
    return (
      <>
        <button onClick={() => void a.signOut()}>out</button>
      </>
    );
  }

  it("signOut success goes to /sign-in; failure shows a toast", async () => {
    const signOut = vi
      .fn()
      .mockResolvedValueOnce(ok(undefined))
      .mockResolvedValueOnce(err("UNAVAILABLE", "Not built yet"));
    render(<Buttons />, { wrapper: wrapper({ auth: { signOut } }) });
    fireEvent.click(screen.getByText("out"));
    await waitFor(() => {
      expect(nav.replace).toHaveBeenCalledWith("/sign-in");
    });
    fireEvent.click(screen.getByText("out"));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Not built yet");
    });
  });
});
