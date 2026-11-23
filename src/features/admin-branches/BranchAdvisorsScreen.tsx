"use client";

import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { useRepoQuery } from "@/hooks/useRepoQuery";
import { AdvisorsPanel } from "./AdvisorsPanel";

/** Main admin: one branch's page with its advisors. */
export function BranchAdvisorsScreen({ branchId }: { branchId: string }) {
  const q = useRepoQuery(["branches", "list"], (da) => da.branches.listBranches());
  const branch = q.data?.find((b) => b.id === branchId);
  return (
    <main className="mx-auto grid max-w-3xl gap-4 p-4 sm:p-6">
      <Link
        href="/admin/branches"
        className="flex min-h-12 w-fit items-center gap-2 text-sm text-muted-foreground"
      >
        <ArrowLeftIcon className="size-4" aria-hidden /> All branches
      </Link>
      {q.isLoading && <PageSkeleton />}
      {q.error !== undefined && (
        <p role="alert" className="text-danger">
          {q.error.code === "FORBIDDEN" ? "Not allowed" : q.error.message}
        </p>
      )}
      {q.data !== undefined && branch === undefined && (
        <p role="alert" className="text-danger">
          Branch not found
        </p>
      )}
      {branch !== undefined && (
        <>
          <h1 className="text-2xl font-semibold">
            {branch.name}{" "}
            <span className="text-base font-normal text-muted-foreground">· {branch.city}</span>
          </h1>
          <h2 className="text-lg font-semibold">Advisors</h2>
          <AdvisorsPanel branchId={branch.id} canAdd={branch.active} />
        </>
      )}
    </main>
  );
}
