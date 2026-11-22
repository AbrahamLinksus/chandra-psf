"use client";

import { UsersIcon } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { SaveState } from "@/components/shared/SaveState";
import { AddUserForm } from "./AddUserForm";
import { UserRow } from "./UserRow";
import { useUserList } from "./useUserList";

export function UsersScreen() {
  const l = useUserList();
  const saving = l.mutation.status === "saving";
  return (
    <main className="mx-auto grid max-w-3xl gap-4 p-4 sm:p-6">
      <h1 className="text-2xl font-semibold">Support users</h1>
      <AddUserForm />
      {l.isLoading && <PageSkeleton />}
      {l.error !== undefined && (
        <p role="alert" className="text-danger">
          {l.error.message}
        </p>
      )}
      {l.pending === null && l.mutation.status === "error" && (
        <SaveState
          status="error"
          error={l.mutation.error}
          onRetry={() => {
            l.mutation.reset();
          }}
        />
      )}
      {l.users?.length === 0 && <EmptyState icon={UsersIcon} title="No users yet" />}
      <ul className="grid gap-2">
        {l.users?.map((u) => (
          <UserRow
            key={u.id}
            user={u}
            isSelf={u.id === l.meId}
            busy={saving}
            onToggle={l.request}
          />
        ))}
      </ul>
      <ConfirmDialog
        open={l.pending !== null}
        title={`Deactivate ${l.pending?.user.name ?? "user"}?`}
        body="They are signed out now and can't sign in until you reactivate them."
        confirmLabel="Deactivate"
        destructive
        status={
          <SaveState status={l.mutation.status} error={l.mutation.error} onRetry={l.confirm} />
        }
        onConfirm={l.confirm}
        onClose={l.close}
      />
    </main>
  );
}
