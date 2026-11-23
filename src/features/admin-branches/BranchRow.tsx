"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BranchWithCount } from "@/data/access/repos/branches";
import type { RepoError } from "@/data/access";
import { fieldMessage } from "./branchMessages";
import { useInlineEdit } from "./useInlineEdit";

export interface BranchRowProps {
  branch: BranchWithCount;
  busy: boolean;
  onRename: (id: string, v: { name: string; city: string }) => Promise<RepoError | null>;
  onToggle: (b: BranchWithCount, active: boolean) => void;
}

function EditFields(props: {
  value: { name: string; city: string };
  error: string | null;
  onChange: (v: { name: string; city: string }) => void;
}) {
  const { value, error, onChange } = props;
  return (
    <div className="grid w-full gap-2 sm:grid-cols-2">
      <Input
        aria-label="Branch name"
        className="h-12"
        value={value.name}
        aria-invalid={error !== null}
        onChange={(e) => {
          onChange({ ...value, name: e.target.value });
        }}
      />
      <Input
        aria-label="City"
        className="h-12"
        value={value.city}
        onChange={(e) => {
          onChange({ ...value, city: e.target.value });
        }}
      />
      {error !== null && (
        <p role="alert" className="text-sm text-danger sm:col-span-2">
          {error}
        </p>
      )}
    </div>
  );
}

export function BranchRow({ branch, busy, onRename, onToggle }: BranchRowProps) {
  const edit = useInlineEdit(
    { name: branch.name, city: branch.city },
    (v) => onRename(branch.id, v),
    (e) => fieldMessage(e, "branch"),
  );
  return (
    <li
      data-branch-name={branch.name}
      data-active={branch.active}
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
    >
      {edit.editing ? (
        <EditFields value={edit.draft} error={edit.error} onChange={edit.setDraft} />
      ) : (
        <span className="grid min-w-0 gap-0.5">
          <span className="font-medium">{branch.name}</span>
          <span className="text-sm text-muted-foreground">
            {branch.city} · {branch.staffCount} staff · {branch.active ? "Active" : "Inactive"}
          </span>
        </span>
      )}
      <span className="flex flex-wrap items-center gap-2">
        {edit.editing ? (
          <>
            <Button className="h-12" disabled={busy} onClick={() => void edit.submit()}>
              Save
            </Button>
            <Button variant="outline" className="h-12" onClick={edit.cancel}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button asChild variant="outline" className="h-12">
              <Link href={`/admin/branches/${branch.id}`}>Advisors</Link>
            </Button>
            <Button variant="outline" className="h-12" onClick={edit.open}>
              Rename
            </Button>
            <Button
              variant="outline"
              className="h-12"
              disabled={busy}
              onClick={() => {
                onToggle(branch, !branch.active);
              }}
            >
              {branch.active ? "Deactivate" : "Reactivate"}
            </Button>
          </>
        )}
      </span>
    </li>
  );
}
