import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ComponentProps, type ReactNode } from "react";
import { err, type DataAccess } from "@/data/access";
import { DataAccessProvider } from "@/data/access/provider";
import type { StaffRole } from "@/domain/roles";
import type { User } from "@/domain/types";

type ProviderProps = ComponentProps<typeof DataAccessProvider>;
type Repos = Omit<DataAccess, "subscribe">;
export interface FakeOverrides extends Partial<{ [K in keyof Repos]: Partial<Repos[K]> }> {
  subscribe?: DataAccess["subscribe"];
}

const REPO_NAMES = [
  "auth",
  "jobCards",
  "visits",
  "feedback",
  "analytics",
  "alerts",
  "responses",
  "audit",
  "users",
  "branches",
  "advisors",
  "customers",
] as const;

/**
 * Every repo method answers UNAVAILABLE unless a test overrides it, so a screen or hook under
 * test only needs the calls it makes. Replaces the removed in-browser demo backend.
 */
export function fakeDataAccess(overrides: FakeOverrides = {}): DataAccess {
  const unavailable = () => Promise.resolve(err("UNAVAILABLE", "Not available in this test"));
  const out: Record<string, unknown> = {
    subscribe: overrides.subscribe ?? (() => () => undefined),
  };
  for (const name of REPO_NAMES) {
    const custom = (overrides[name] ?? {}) as Record<string, unknown>;
    out[name] = new Proxy(custom, {
      get: (target, method: string) => target[method] ?? unavailable,
    });
  }
  return out as unknown as DataAccess;
}

/** A QueryClient + DataAccessProvider wrapper for renderHook / render. */
export function dataWrapper(da: DataAccess = fakeDataAccess()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client },
      createElement(DataAccessProvider, { value: da } as ProviderProps, children),
    );
  };
}

export function makeUser(role: StaffRole = "support", over: Partial<User> = {}): User {
  return {
    id: "u",
    name: "Asha",
    email: "asha@example.test",
    role,
    active: true,
    mustSetPassword: false,
    branchId: role === "main_admin" ? null : "b1",
    branchName: role === "main_admin" ? null : "Anna Nagar",
    lastSignInAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}
