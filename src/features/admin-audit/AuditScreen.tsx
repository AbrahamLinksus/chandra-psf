"use client";

import { ScrollTextIcon } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";
import { AuditActionFilter } from "./AuditActionFilter";
import { AuditBranchFilter } from "./AuditBranchFilter";
import { AuditRow } from "./AuditRow";
import { useAudit } from "./useAudit";

export function AuditScreen() {
  const a = useAudit();
  const { action, setAction, rows, error, isLoading } = a;
  return (
    <main className="mx-auto grid max-w-3xl grid-cols-[minmax(0,1fr)] gap-4 p-4 sm:p-6">
      <h1 className="text-2xl font-semibold">Audit log</h1>
      <AuditActionFilter value={action} onChange={setAction} />
      {a.isMain && (
        <AuditBranchFilter value={a.branchId} options={a.branchOptions} onChange={a.setBranchId} />
      )}
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
      {a.moreError !== undefined && (
        <p role="alert" className="text-danger">
          {a.moreError}
        </p>
      )}
      {a.hasMore && (
        <Button
          type="button"
          variant="outline"
          className="h-12"
          disabled={a.loadingMore}
          onClick={() => void a.loadMore()}
        >
          {a.loadingMore ? "Loading…" : "Load more"}
        </Button>
      )}
    </main>
  );
}
