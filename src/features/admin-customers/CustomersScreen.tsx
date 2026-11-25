"use client";

import { DownloadIcon, SearchXIcon, Trash2Icon } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CustomerResultRow } from "./CustomerRow";
import { EraseDialog } from "./EraseDialog";
import type { CustomerRow } from "@/data/access/repos/customers";
import { useCustomerSearch } from "./useCustomerSearch";

export function CustomersScreen() {
  const c = useCustomerSearch();
  return (
    <main className="mx-auto grid max-w-3xl grid-cols-[minmax(0,1fr)] gap-4 p-4 sm:p-6">
      <h1 className="text-2xl font-semibold">Customers</h1>
      <form
        className="grid gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          void c.search();
        }}
      >
        <Label htmlFor="customer-q">Phone number or registration number</Label>
        <div className="flex gap-2">
          <Input
            id="customer-q"
            className="h-12"
            value={c.text}
            onChange={(e) => {
              c.setText(e.target.value);
            }}
          />
          <Button type="submit" className="h-12" disabled={c.busy || c.text.trim() === ""}>
            Search
          </Button>
        </div>
      </form>
      {c.error !== undefined && (
        <p role="alert" className="text-danger">
          {c.error}
        </p>
      )}
      {c.erase.notice !== undefined && (
        <p role="status" data-testid="erase-notice">
          {c.erase.notice}
        </p>
      )}
      {c.rows?.length === 0 && (
        <EmptyState
          icon={SearchXIcon}
          title="No customer found with that number"
          hint="Check the number and try again."
        />
      )}
      {c.rows !== undefined && c.rows.length > 0 && <Results c={c} rows={c.rows} />}
    </main>
  );
}

function Results({ c, rows }: { c: ReturnType<typeof useCustomerSearch>; rows: CustomerRow[] }) {
  return (
    <>
      <ul className="grid gap-2">
        {rows.map((r) => (
          <CustomerResultRow
            key={r.jobCardId}
            row={r}
            checked={c.ticked.includes(r.jobCardId)}
            onToggle={() => {
              c.toggle(r.jobCardId);
            }}
          />
        ))}
      </ul>
      <Button
        type="button"
        className="h-12"
        disabled={c.ticked.length === 0 || c.busy}
        onClick={() => void c.download()}
      >
        <DownloadIcon /> Download
      </Button>
      <Button
        type="button"
        variant="destructive"
        className="h-12"
        disabled={c.ticked.length === 0 || c.busy}
        onClick={c.erase.open}
      >
        <Trash2Icon /> Erase selected
      </Button>
      {c.erase.confirming && (
        <EraseDialog
          count={c.ticked.length}
          busy={c.erase.busy}
          error={c.erase.error}
          onConfirm={(pw) => void c.erase.erase(pw)}
          onClose={c.erase.close}
        />
      )}
    </>
  );
}
