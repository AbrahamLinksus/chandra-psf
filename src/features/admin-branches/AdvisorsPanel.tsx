"use client";

import { UserRoundIcon } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { SaveState } from "@/components/shared/SaveState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdvisorRow } from "./AdvisorRow";
import { useAdvisorList } from "./useAdvisorList";

type Panel = ReturnType<typeof useAdvisorList>;

function AddAdvisorForm({ l }: { l: Panel }) {
  return (
    <form noValidate onSubmit={l.onSubmit} className="grid gap-3 rounded-xl border p-4">
      <h2 className="text-lg font-semibold">Add advisor</h2>
      <div className="grid gap-1.5">
        <Label htmlFor="add-advisor-name">Advisor name</Label>
        <Input
          id="add-advisor-name"
          className="h-12"
          autoComplete="off"
          value={l.name}
          aria-invalid={l.addError !== null}
          onChange={(e) => {
            l.setName(e.target.value);
          }}
        />
        {l.addError !== null && (
          <p role="alert" className="text-sm text-danger">
            {l.addError}
          </p>
        )}
      </div>
      <SaveState status={l.add.status} error={l.add.error} onRetry={() => void l.retryAdd()} />
      <Button type="submit" className="h-12 sm:w-fit" disabled={l.add.status === "saving"}>
        Add advisor
      </Button>
    </form>
  );
}

function ListStatus({ l }: { l: Panel }) {
  return (
    <>
      {l.isLoading && <PageSkeleton />}
      {l.error !== undefined && (
        <p role="alert" className="text-danger">
          {l.error.code === "FORBIDDEN" ? "Not allowed" : l.error.message}
        </p>
      )}
      {l.toggle.status === "error" && (
        <p role="alert" className="text-sm text-danger">
          {l.toggle.error?.message ?? "Couldn't save, try again"}
        </p>
      )}
      {l.advisors?.length === 0 && (
        <EmptyState
          icon={UserRoundIcon}
          title="No advisors yet"
          hint="Add an advisor so job cards can name who served the customer."
        />
      )}
    </>
  );
}

/** Advisors list with add / rename / deactivate for one branch. `branchId` undefined = own scope. */
export function AdvisorsPanel({
  branchId,
  canAdd,
}: {
  branchId: string | undefined;
  canAdd: boolean;
}) {
  const l = useAdvisorList(branchId);
  return (
    <div className="grid gap-4">
      {canAdd && <AddAdvisorForm l={l} />}
      <ListStatus l={l} />
      <ul className="grid gap-2">
        {l.advisors?.map((a) => (
          <AdvisorRow
            key={a.id}
            advisor={a}
            busy={l.busy}
            onRename={l.renameAdvisor}
            onToggle={l.setActive}
          />
        ))}
      </ul>
    </div>
  );
}
