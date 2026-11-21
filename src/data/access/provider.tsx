"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import type { DataAccess } from "./index";

const DataAccessContext = createContext<DataAccess | null>(null);

const subscribeNever = (): (() => void) => () => undefined;
const onClient = (): boolean => true;
const onServer = (): boolean => false;

/** Renders children only after mount (storage is client-only); full-page skeleton before. */
export function DataAccessProvider({ value, children }: { value: DataAccess | null; children: ReactNode }) {
  const mounted = useSyncExternalStore(subscribeNever, onClient, onServer);
  if (!mounted || value === null) {
    return (
      <div className="flex min-h-screen items-center justify-center" aria-busy="true">
        <div className="bg-muted h-24 w-72 animate-pulse rounded-xl" />
      </div>
    );
  }
  return <DataAccessContext.Provider value={value}>{children}</DataAccessContext.Provider>;
}

export function useDataAccess(): DataAccess {
  const da = useContext(DataAccessContext);
  if (da === null) throw new Error("useDataAccess must be used inside DataAccessProvider");
  return da;
}
