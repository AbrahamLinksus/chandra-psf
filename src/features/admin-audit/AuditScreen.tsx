"use client";

import { ScrollTextIcon } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { AuditActionFilter } from "./AuditActionFilter";
import { AuditRow } from "./AuditRow";
import { useAudit } from "./useAudit";

export function AuditScreen() {
  const { action, setAction, rows, error, isLoading } = useAudit();
  return (
    <main className="mx-auto grid max-w-3xl gap-4 p-4 sm:p-6">
      <h1 className="text-2xl font-semibold">Audit log</h1>
      <AuditActionFilter value={action} onChange={setAction} />
      {isLoading && <PageSkeleton />}
      {error !== undefined && (
        <p role="alert" className="text-danger">
          {error.message}
        </p>
      )}
      {rows?.length === 0 && (
        <EmptyState icon={ScrollTextIcon} title="No audit entries" hint="Nothing matches yet." />
      )}
      <ul className="grid gap-2">
        {rows?.map((e) => (
          <AuditRow key={e.id} entry={e} />
        ))}
      </ul>
    </main>
  );
}
