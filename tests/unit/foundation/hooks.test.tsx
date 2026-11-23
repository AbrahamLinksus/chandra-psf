import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeDataAccess, makeUser } from "../../support/fakeDataAccess";
import { guardRedirect } from "@/components/shared/RoleGuard";
import { SaveState } from "@/components/shared/SaveState";
import { activeNavHref, navFor } from "@/components/shared/adminNav";
import { err, ok, type DataAccess, type Topic } from "@/data/access";
import { DataAccessProvider, useDataAccess } from "@/data/access/provider";
import type { StaffRole } from "@/domain/roles";
import type { User } from "@/domain/types";
import { useLiveInvalidation } from "@/hooks/useLiveInvalidation";
import { useOpenAlertCount } from "@/hooks/useOpenAlertCount";
import { useRepoMutation } from "@/hooks/useRepoMutation";
import { useRepoQuery } from "@/hooks/useRepoQuery";
import { useSession } from "@/hooks/useSession";

afterEach(cleanup);

const user = (role: StaffRole, mustSetPassword = false): User =>
  makeUser(role, { mustSetPassword });

function wrap(da: Partial<DataAccess>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const value = { subscribe: () => () => undefined, ...da } as DataAccess;
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <DataAccessProvider value={value}>{children}</DataAccessProvider>
    </QueryClientProvider>
  );
  return Wrapper;
}

describe("SaveState (S-13)", () => {
  const noop = () => undefined;

  it("saving shows a status; idle and done render nothing", () => {
    const { rerender } = render(<SaveState status="saving" onRetry={noop} />);
    expect(screen.getByText(/Saving/)).toBeTruthy();
    rerender(<SaveState status="idle" onRetry={noop} />);
    expect(screen.queryByRole("alert")).toBeNull();
    rerender(<SaveState status="done" onRetry={noop} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("SAVE_FAILED shows 'Couldn't save, try again' and Retry calls onRetry", () => {
    const onRetry = vi.fn();
    const error = { code: "SAVE_FAILED", message: "Simulated failed save" } as const;
    render(<SaveState status="error" error={error} onRetry={onRetry} />);
    expect(screen.getByText("Couldn't save, try again")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("other error codes show their own message", () => {
    const error = { code: "CONFLICT", message: "Already there" } as const;
    render(<SaveState status="error" error={error} onRetry={noop} />);
    expect(screen.getByText("Already there")).toBeTruthy();
  });
});

describe("useRepoMutation", () => {
  function Probe({ failFirst }: { failFirst: boolean }) {
    const m = useRepoMutation<string, number>((_da, input) => {
      if (input === "throw") return Promise.reject(new Error("boom"));
      if (input === "fail" && failFirst) {
        return Promise.resolve(err<number>("SAVE_FAILED", "Couldn't save, try again"));
      }
      return Promise.resolve(ok(1));
    });
    return (
      <>
        <span data-testid="s">{m.status}</span>
        <span data-testid="e">{m.error?.code ?? ""}</span>
        <button
          onClick={() => {
            void m.run("ok");
          }}
        >
          ok
        </button>
        <button
          onClick={() => {
            void m.run("fail");
          }}
        >
          fail
        </button>
        <button
          onClick={() => {
            void m.run("throw");
          }}
        >
          throw
        </button>
        <button
          onClick={() => {
            m.reset();
          }}
        >
          reset
        </button>
        <SaveState
          status={m.status}
          error={m.error}
          onRetry={() => {
            void m.run("ok");
          }}
        />
      </>
    );
  }

  it("success → done", async () => {
    render(<Probe failFirst={false} />, { wrapper: wrap({}) });
    fireEvent.click(screen.getByText("ok"));
    await waitFor(() => {
      expect(screen.getByTestId("s").textContent).toBe("done");
    });
  });

  it("failed write → SaveState shows the message and Retry; Retry succeeds (S-13)", async () => {
    render(<Probe failFirst />, { wrapper: wrap({}) });
    fireEvent.click(screen.getByText("fail"));
    await waitFor(() => {
      expect(screen.getByText("Couldn't save, try again")).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => {
      expect(screen.getByTestId("s").textContent).toBe("done");
    });
  });

  it("a thrown error becomes SAVE_FAILED and reset returns to idle", async () => {
    render(<Probe failFirst={false} />, { wrapper: wrap({}) });
    fireEvent.click(screen.getByText("throw"));
    await waitFor(() => {
      expect(screen.getByTestId("e").textContent).toBe("SAVE_FAILED");
    });
    fireEvent.click(screen.getByText("reset"));
    expect(screen.getByTestId("s").textContent).toBe("idle");
  });
});

describe("data hooks", () => {
  it("useRepoQuery surfaces an error result instead of throwing", async () => {
    function P() {
      const q = useRepoQuery(["users"], () =>
        Promise.resolve(err<number>("UNAVAILABLE", "Not built yet")),
      );
      return <span>{q.isLoading ? "loading" : (q.error?.message ?? "data")}</span>;
    }
    render(<P />, { wrapper: wrap({}) });
    await waitFor(() => {
      expect(screen.getByText("Not built yet")).toBeTruthy();
    });
  });

  it("useSession returns the user; useOpenAlertCount is 0 when the repo is unavailable", async () => {
    function P() {
      const s = useSession();
      const n = useOpenAlertCount();
      return <span>{`${s.user?.name ?? "none"}:${String(n)}`}</span>;
    }
    const da = {
      auth: { currentUser: () => Promise.resolve(ok<User | null>(user("main_admin"))) },
      alerts: { countOpen: () => Promise.resolve(err<number>("UNAVAILABLE", "Not built yet")) },
    } as unknown as Partial<DataAccess>;
    render(<P />, { wrapper: wrap(da) });
    await waitFor(() => {
      expect(screen.getByText("Asha:0")).toBeTruthy();
    });
  });

  it("useOpenAlertCount shows the count when the repo answers", async () => {
    function P() {
      return <span>{`n=${String(useOpenAlertCount())}`}</span>;
    }
    const da = {
      alerts: { countOpen: () => Promise.resolve(ok(4)) },
    } as unknown as Partial<DataAccess>;
    render(<P />, { wrapper: wrap(da) });
    await waitFor(() => {
      expect(screen.getByText("n=4")).toBeTruthy();
    });
  });

  it("useDataAccess outside the provider throws", () => {
    function P() {
      useDataAccess();
      return null;
    }
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<P />)).toThrow(/DataAccessProvider/);
    spy.mockRestore();
  });

  it("useLiveInvalidation: a change signalled by the data layer refreshes the query (S-06)", async () => {
    let notify: (topics: Topic[]) => void = () => undefined;
    const da = fakeDataAccess({
      subscribe: (listener) => {
        notify = listener;
        return () => undefined;
      },
    });
    let reads = 0;
    function P() {
      useLiveInvalidation();
      useRepoQuery(["audit"], () => {
        reads += 1;
        return Promise.resolve(ok(reads));
      });
      return <span>ok</span>;
    }
    render(<P />, { wrapper: wrap(da) });
    await waitFor(() => {
      expect(reads).toBe(1);
    });
    act(() => {
      notify(["audit"]);
    });
    await waitFor(() => {
      expect(reads).toBeGreaterThan(1);
    });
  });
});

describe("shell logic", () => {
  it("guardRedirect: no session, wrong role, must-set-password, allowed", () => {
    const admins = ["branch_admin", "main_admin"] as const;
    expect(guardRedirect(null, admins)).toBe("/sign-in");
    expect(guardRedirect(user("support"), admins)).toBe("/not-allowed");
    expect(guardRedirect(user("main_admin", true), admins)).toBe("/set-password");
    expect(guardRedirect(user("branch_admin"), admins)).toBeNull();
    expect(guardRedirect(user("main_admin"), admins)).toBeNull();
    expect(guardRedirect(user("support"), ["support"])).toBeNull();
  });

  it("nav per role: Branches and Customers for main admins only, Advisors for branch admins only, My account for all", () => {
    const labels = (r: StaffRole) => navFor(r).map((i) => i.label);
    expect(labels("main_admin")).toEqual(
      expect.arrayContaining(["Branches", "Customers", "My account"]),
    );
    expect(labels("main_admin")).not.toContain("Advisors");
    expect(labels("branch_admin")).toContain("Advisors");
    expect(labels("branch_admin")).toContain("My account");
    expect(labels("branch_admin")).not.toContain("Branches");
    expect(labels("branch_admin")).not.toContain("Customers");
    expect(navFor("main_admin").find((i) => i.label === "Simulate failed save")).toBeUndefined();
  });

  it("activeNavHref picks the longest matching nav item", () => {
    expect(activeNavHref("/admin")).toBe("/admin");
    expect(activeNavHref("/admin/responses/deleted")).toBe("/admin/responses/deleted");
    expect(activeNavHref("/admin/responses/abc")).toBe("/admin/responses");
    expect(activeNavHref("/elsewhere")).toBeNull();
  });
});
