"use client";

import { BellOffIcon } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { AlertDrawer } from "./AlertDrawer";
import { AlertFilterBar } from "./AlertFilter";
import { AlertRow } from "./AlertRow";
import { useAlerts } from "./useAlerts";

export function AlertsScreen() {
  const { filter, setFilter, rows, total, selected, select, error, isLoading } = useAlerts();
  return (
    <main className="mx-auto grid max-w-3xl gap-4 p-4 sm:p-6">
      <h1 className="text-2xl font-semibold">Alerts</h1>
      <AlertFilterBar value={filter} onChange={setFilter} />
      {isLoading && <PageSkeleton />}
      {error !== undefined && (
        <p role="alert" className="text-danger">
          {error.message}
        </p>
      )}
      {total === 0 && <EmptyState icon={BellOffIcon} title="No alerts — all customers happy" />}
      {total !== undefined && total > 0 && rows?.length === 0 && (
        <EmptyState icon={BellOffIcon} title="No alerts with this status" />
      )}
      <ul className="grid gap-2">
        {rows?.map((a) => (
          <AlertRow
            key={a.id}
            alert={a}
            onOpen={() => {
              select(a.id);
            }}
          />
        ))}
      </ul>
      <AlertDrawer
        alert={selected}
        onClose={() => {
          select(null);
        }}
      />
    </main>
  );
}
