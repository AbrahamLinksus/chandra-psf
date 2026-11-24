"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { POLL_SECONDS } from "@/config/env";
import { Toaster } from "@/components/ui/sonner";
import { DataAccessProvider } from "@/data/access/provider";
import { createActivityTracker } from "@/data/remote/activity";
import { createPoller } from "@/data/remote/poller";
import { createRemoteDataAccess } from "@/data/remote/createRemoteDataAccess";
import { useLiveInvalidation } from "@/hooks/useLiveInvalidation";
import { SESSION_KEY } from "@/hooks/useSession";

function LiveInvalidation() {
  useLiveInvalidation();
  return null;
}

/** Browser-only wiring: a session that ended on the server refreshes the session query. */
function createClientDataAccess(queryClient: QueryClient) {
  if (typeof window === "undefined") return null;
  const activity = createActivityTracker({ target: window });
  const poller = createPoller({
    activity,
    pollSeconds: POLL_SECONDS,
    doc: document,
    getPathname: () => window.location.pathname,
    hasStaffSession: () => {
      const cached = queryClient.getQueryData<{ ok: boolean; value?: unknown }>(SESSION_KEY);
      return cached?.ok === true && cached.value != null;
    },
  });
  return createRemoteDataAccess({
    fetch: (input, init) => window.fetch(input, init),
    activity,
    poller,
    onUnauthenticated: () => {
      void queryClient.invalidateQueries({ queryKey: SESSION_KEY, refetchType: "all" });
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
      }),
  );
  const [dataAccess] = useState(() => createClientDataAccess(queryClient));
  return (
    <QueryClientProvider client={queryClient}>
      <DataAccessProvider value={dataAccess}>
        <LiveInvalidation />
        {children}
        <Toaster />
      </DataAccessProvider>
    </QueryClientProvider>
  );
}
