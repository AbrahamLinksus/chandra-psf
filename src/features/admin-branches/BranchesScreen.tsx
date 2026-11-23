"use client";

import { BuildingIcon } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { SaveState } from "@/components/shared/SaveState";
import { AddBranchForm } from "./AddBranchForm";
import { BranchRow } from "./BranchRow";
import { useBranchList } from "./useBranchList";

type List = ReturnType<typeof useBranchList>;

function ListStatus({ l }: { l: List }) {
  return (
    <>
      {l.isLoading && <PageSkeleton />}
      {l.error !== undefined && (
        <p role="alert" className="text-danger">
          {l.error.code === "FORBIDDEN" ? "Not allowed" : l.error.message}
        </p>
      )}
      {l.pending === null && l.toggle.status === "error" && (
        <SaveState status="error" error={l.toggle.error} onRetry={l.retry} />
      )}
      {l.branches?.length === 0 && (
        <EmptyState
          icon={BuildingIcon}
          title="No branches yet"
          hint="Add your first branch above, then add its advisors and users."
        />
      )}
    </>
  );
}

export function BranchesScreen() {
  const l = useBranchList();
  return (
    <main className="mx-auto grid max-w-3xl gap-4 p-4 sm:p-6">
      <h1 className="text-2xl font-semibold">Branches</h1>
      <AddBranchForm />
      <ListStatus l={l} />
      <ul className="grid gap-2">
        {l.branches?.map((b) => (
          <BranchRow key={b.id} branch={b} busy={l.busy} onRename={l.rename} onToggle={l.request} />
        ))}
      </ul>
      <ConfirmDialog
        open={l.pending !== null}
        title={`Deactivate ${l.pending?.name ?? "branch"}?`}
        body="Its staff are signed out now and can't sign in (Account disabled, contact admin). Data and history are kept."
        confirmLabel="Deactivate"
        destructive
        status={<SaveState status={l.toggle.status} error={l.toggle.error} onRetry={l.confirm} />}
        onConfirm={l.confirm}
        onClose={l.close}
      />
    </main>
  );
}
