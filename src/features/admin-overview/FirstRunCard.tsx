"use client";

import Link from "next/link";
import { BuildingIcon } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { useRepoQuery } from "@/hooks/useRepoQuery";
import { useSession } from "@/hooks/useSession";

/** Main admin on a fresh system: "Add your first branch" to /admin/branches. Null otherwise. */
export function FirstRunCard() {
  const { user } = useSession();
  const branches = useRepoQuery(["branches", "list"], (da) => da.branches.listBranches());
  if (user?.role !== "main_admin" || branches.data?.length !== 0) return null;
  return (
    <section className="rounded-2xl border bg-card shadow-sm" aria-label="First run">
      <EmptyState
        icon={BuildingIcon}
        title="Add your first branch"
        hint="Start with a branch, then its advisors, then its users."
      />
      <div className="flex justify-center pb-6">
        <Button asChild className="h-12">
          <Link href="/admin/branches">Add your first branch</Link>
        </Button>
      </div>
    </section>
  );
}
