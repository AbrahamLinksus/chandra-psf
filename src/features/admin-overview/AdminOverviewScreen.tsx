"use client";

import { Suspense } from "react";
import { FilterBar } from "@/components/shared/FilterBar";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { BranchFilter } from "./BranchFilter";
import { FirstRunCard } from "./FirstRunCard";
import { KpiTiles } from "./KpiTiles";
import { OverviewBlocks } from "./OverviewBlocks";
import { useOverview } from "./useOverview";

function OverviewContent() {
  const {
    filters,
    branchId,
    setBranchId,
    setFilters,
    data,
    options,
    errorCode,
    errorMessage,
    isLoading,
  } = useOverview();
  if (errorCode !== undefined) {
    return (
      <p role="alert" className="text-danger">
        {errorCode === "FORBIDDEN" ? "Not allowed" : errorMessage}
      </p>
    );
  }
  if (isLoading || data === undefined || options === undefined) return <PageSkeleton />;
  return (
    <div className="grid min-w-0 grid-cols-1 gap-4">
      {options.branches && (
        <BranchFilter branches={options.branches} value={branchId} onChange={setBranchId} />
      )}
      <FilterBar value={filters} onChange={setFilters} options={options} />
      <KpiTiles kpis={data.kpis} />
      <OverviewBlocks
        data={data}
        showBranch={options.branches !== undefined && branchId === undefined}
      />
    </div>
  );
}

export function AdminOverviewScreen() {
  return (
    <main className="mx-auto grid max-w-screen-2xl grid-cols-1 gap-4 p-4 sm:p-6">
      <h1 className="text-2xl font-semibold">Overview</h1>
      <FirstRunCard />
      <Suspense fallback={<PageSkeleton />}>
        <OverviewContent />
      </Suspense>
    </main>
  );
}
