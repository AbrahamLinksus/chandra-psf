"use client";

import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { useSession } from "@/hooks/useSession";
import { AdvisorsPanel } from "./AdvisorsPanel";

/** Branch admin: advisors of their own branch (server scopes the list). */
export function AdvisorsScreen() {
  const { user, isLoading } = useSession();
  const branchId = user?.branchId ?? undefined;
  return (
    <main className="mx-auto grid max-w-3xl gap-4 p-4 sm:p-6">
      <h1 className="text-2xl font-semibold">Advisors</h1>
      {isLoading ? (
        <PageSkeleton />
      ) : (
        <AdvisorsPanel
          key={branchId ?? "none"}
          branchId={branchId}
          canAdd={branchId !== undefined}
        />
      )}
    </main>
  );
}
