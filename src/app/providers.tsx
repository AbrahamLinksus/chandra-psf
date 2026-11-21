"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { DataAccessProvider } from "@/data/access/provider";
import { createLocalDataAccess } from "@/data/local/createLocalDataAccess";
import { useLiveInvalidation } from "@/hooks/useLiveInvalidation";

function LiveInvalidation() {
  useLiveInvalidation();
  return null;
}

/** Storage only exists in the browser, so the data layer is not created during prerender. */
function createClientDataAccess() {
  if (typeof window === "undefined") return null;
  return createLocalDataAccess({
    storage: window.localStorage,
    locks: "locks" in navigator ? navigator.locks : null,
    clock: { now: () => new Date() },
    win: window,
  });
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  );
  const [dataAccess] = useState(createClientDataAccess);
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
