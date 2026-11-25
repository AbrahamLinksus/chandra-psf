"use client";

import { ArrowLeftIcon, Trash2Icon, Undo2Icon } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { PasswordPromptDialog } from "@/components/shared/PasswordPromptDialog";
import { Button } from "@/components/ui/button";
import { formatIST, formatISTDate } from "@/domain/time";
import { useDeleted } from "./useDeleted";

export function DeletedScreen() {
  const { rows, error, isLoading, restoring, ask, close, restore } = useDeleted();
  return (
    <main className="mx-auto grid max-w-3xl gap-4 p-4 sm:p-6">
      <Link href="/admin/responses" className="inline-flex min-h-12 items-center gap-2 underline">
        <ArrowLeftIcon className="size-4" aria-hidden /> Responses
      </Link>
      <h1 className="text-2xl font-semibold">Recently deleted</h1>
      {isLoading && <PageSkeleton />}
      {error !== undefined && (
        <p role="alert" className="text-danger">
          {error.message}
        </p>
      )}
      {rows?.length === 0 && <EmptyState icon={Trash2Icon} title="Nothing deleted" />}
      <ul className="grid gap-2">
        {rows?.map((r) => (
          <li
            key={r.id}
            data-response-id={r.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3"
          >
            <span className="grid min-w-0 gap-0.5">
              <span className="font-medium break-words">{r.customerName}</span>
              <span className="text-sm text-muted-foreground">
                Service {formatISTDate(r.serviceDate, { year: true })} · Deleted{" "}
                {formatIST(r.deletedAt)} · Removed for good on{" "}
                {formatISTDate(r.purgeOn, { year: true })}
              </span>
            </span>
            <Button
              type="button"
              variant="outline"
              className="h-12"
              onClick={() => {
                ask(r.id);
              }}
            >
              <Undo2Icon aria-hidden /> Restore
            </Button>
          </li>
        ))}
      </ul>
      <PasswordPromptDialog
        open={restoring !== null}
        title="Restore response"
        onConfirm={restore}
        onClose={close}
      />
    </main>
  );
}
