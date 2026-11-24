"use client";

import type { SyntheticEvent } from "react";
import { SaveState } from "@/components/shared/SaveState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { JobCardView } from "@/data/access/repos/jobCards";
import { useRepoQuery } from "@/hooks/useRepoQuery";
import { AdvisorField } from "./AdvisorField";
import { ExistsNotice } from "./ExistsNotice";
import { FormField } from "./FormField";
import { JobCardVehicleFields } from "./JobCardVehicleFields";
import { useJobCardForm } from "./useJobCardForm";

interface Props {
  initialNo: string;
  onSaved: (card: JobCardView) => void;
  onCancel: () => void;
  onOpenExisting: (no: string) => void;
}

/** "New job card" form (SPEC F-2 fields). Server validation messages show under the field they name. */
export function JobCardForm({ initialNo, onSaved, onCancel, onOpenExisting }: Props) {
  const f = useJobCardForm(initialNo, onSaved);
  const advisors = useRepoQuery(["advisors", "list", "own"], (da) =>
    da.advisors.listAdvisors({ activeOnly: true }),
  );
  const list = advisors.data ?? [];
  const noAdvisors = advisors.data !== undefined && list.length === 0;
  const msgFor = (field: string) =>
    f.error?.code === "VALIDATION" && f.fields[0] === field ? f.error.message : undefined;
  const submit = (e: SyntheticEvent) => {
    e.preventDefault();
    void f.submit();
  };
  const text = (id: keyof typeof f.values, label: string, extra = {}) => (
    <FormField id={id} label={label} error={msgFor(id)}>
      <Input
        id={id}
        className="h-12"
        value={f.values[id]}
        aria-invalid={msgFor(id) !== undefined}
        onChange={(e) => {
          f.set(id, e.target.value);
        }}
        {...extra}
      />
    </FormField>
  );
  return (
    <form onSubmit={submit} className="grid gap-4 rounded-2xl border bg-card p-4 shadow-sm">
      <h2 className="text-lg font-semibold">New job card</h2>
      {text("jobCardNo", "Job card number")}
      {f.exists && f.error !== undefined && (
        <ExistsNotice
          message={f.error.message}
          onOpen={() => {
            onOpenExisting(f.values.jobCardNo);
          }}
        />
      )}
      {text("customerName", "Customer name")}
      {text("phone", "Mobile (optional)", { type: "tel", inputMode: "tel" })}
      {text("regNo", "Reg. no.", { placeholder: "TN 09 BX 4521" })}
      <JobCardVehicleFields values={f.values} set={f.set} msgFor={msgFor} />
      {text("serviceDate", "Service date", { type: "date" })}
      <AdvisorField
        value={f.values.advisorId}
        advisors={list}
        disabled={noAdvisors}
        error={msgFor("advisorId")}
        onChange={(v) => {
          f.set("advisorId", v);
        }}
      />
      {!f.exists && (f.error?.code !== "VALIDATION" || f.fields.length === 0) && (
        <SaveState status={f.status} error={f.error} onRetry={() => void f.submit()} />
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="h-12" disabled={f.status === "saving" || noAdvisors}>
          Save job card
        </Button>
        <Button type="button" variant="ghost" className="h-12" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
