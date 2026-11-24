"use client";

import { BellOffIcon } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { AlertDrawer } from "./AlertDrawer";
import { AlertBranchFilter } from "./AlertBranchFilter";
import { AlertFilterBar } from "./AlertFilter";
import { AlertRow } from "./AlertRow";
import { useAlerts } from "./useAlerts";

export function AlertsScreen() {
  const a = useAlerts();
  const { filter, setFilter, rows, total, selected, select, error, isLoading } = a;
  return (
    <main className="mx-auto grid max-w-3xl gap-4 p-4 sm:p-6">
      <h1 className="text-2xl font-semibold">Alerts</h1>
      {a.isMain && (
        <AlertBranchFilter value={a.branchId} options={a.branchOptions} onChange={a.setBranchId} />
      )}
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
        {rows?.map((row) => (
          <AlertRow
            key={row.id}
            alert={row}
            showBranch={a.isMain}
            onOpen={() => {
              select(row.id);
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
