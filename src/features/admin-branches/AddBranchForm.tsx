"use client";

import { SaveState } from "@/components/shared/SaveState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAddBranch } from "./useAddBranch";

export function AddBranchForm() {
  const { draft, setField, error, mutation, onSubmit, retry } = useAddBranch();
  return (
    <form noValidate onSubmit={onSubmit} className="grid gap-4 rounded-xl border p-4">
      <h2 className="text-lg font-semibold">Add branch</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="add-branch-name">Branch name</Label>
          <Input
            id="add-branch-name"
            className="h-12"
            autoComplete="off"
            value={draft.name}
            aria-invalid={error !== null}
            aria-describedby={error === null ? undefined : "add-branch-error"}
            onChange={(e) => {
              setField("name", e.target.value);
            }}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="add-branch-city">City</Label>
          <Input
            id="add-branch-city"
            className="h-12"
            autoComplete="off"
            value={draft.city}
            onChange={(e) => {
              setField("city", e.target.value);
            }}
          />
        </div>
      </div>
      {error !== null && (
        <p id="add-branch-error" role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <SaveState status={mutation.status} error={mutation.error} onRetry={() => void retry()} />
      <Button type="submit" className="h-12 sm:w-fit" disabled={mutation.status === "saving"}>
        Add branch
      </Button>
    </form>
  );
}
