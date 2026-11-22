"use client";

import { InboxIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/shared/EmptyState";
import { FilterBar } from "@/components/shared/FilterBar";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { buttonVariants } from "@/components/ui/button";
import { ResponsesTable } from "./ResponsesTable";
import { useResponses } from "./useResponses";

function ResponsesContent() {
  const { filters, setFilters, rows, options, errorMessage, isLoading } = useResponses();
  if (errorMessage !== undefined) {
    return (
      <p role="alert" className="text-danger">
        {errorMessage}
      </p>
    );
  }
  if (isLoading || rows === undefined || options === undefined) return <PageSkeleton />;
  return (
    <div className="grid min-w-0 gap-4">
      <FilterBar value={filters} onChange={setFilters} options={options} />
      {rows.length === 0 ? (
        <EmptyState icon={InboxIcon} title="No responses match these filters" />
      ) : (
        <ResponsesTable rows={rows} />
      )}
    </div>
  );
}

export function ResponsesScreen() {
  return (
    <main className="mx-auto grid max-w-screen-2xl gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Responses</h1>
        <Link
          href="/admin/responses/deleted"
          className={buttonVariants({ variant: "outline", className: "h-12" })}
        >
          <Trash2Icon aria-hidden /> Recently deleted
        </Link>
      </div>
      <Suspense fallback={<PageSkeleton />}>
        <ResponsesContent />
      </Suspense>
    </main>
  );
}
