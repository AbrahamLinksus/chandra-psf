"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RepoError } from "@/data/access";
import type { AdvisorWithBranch } from "@/data/access/repos/advisors";
import { fieldMessage } from "./branchMessages";
import { useInlineEdit } from "./useInlineEdit";

export interface AdvisorRowProps {
  advisor: AdvisorWithBranch;
  busy: boolean;
  onRename: (id: string, name: string) => Promise<RepoError | null>;
  onToggle: (id: string, active: boolean) => void;
}

export function AdvisorRow({ advisor, busy, onRename, onToggle }: AdvisorRowProps) {
  const edit = useInlineEdit(
    advisor.name,
    (v) => onRename(advisor.id, v),
    (e) => fieldMessage(e, "advisor"),
  );
  return (
    <li
      data-advisor-name={advisor.name}
      data-active={advisor.active}
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
    >
      {edit.editing ? (
        <div className="grid w-full gap-1 sm:w-auto sm:flex-1">
          <Input
            aria-label="Advisor name"
            className="h-12"
            value={edit.draft}
            aria-invalid={edit.error !== null}
            onChange={(e) => {
              edit.setDraft(e.target.value);
            }}
          />
          {edit.error !== null && (
            <p role="alert" className="text-sm text-danger">
              {edit.error}
            </p>
          )}
        </div>
      ) : (
        <span className="grid min-w-0 gap-0.5">
          <span className="font-medium">{advisor.name}</span>
          <span className="text-sm text-muted-foreground">
            {advisor.branchName} · {advisor.active ? "Active" : "Inactive"}
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
            <Button variant="outline" className="h-12" onClick={edit.open}>
              Rename
            </Button>
            <Button
              variant="outline"
              className="h-12"
              disabled={busy}
              onClick={() => {
                onToggle(advisor.id, !advisor.active);
              }}
            >
              {advisor.active ? "Deactivate" : "Reactivate"}
            </Button>
          </>
        )}
      </span>
    </li>
  );
}
