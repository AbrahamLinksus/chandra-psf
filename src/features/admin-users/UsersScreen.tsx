"use client";

import { UsersIcon } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { SaveState } from "@/components/shared/SaveState";
import { AddUserForm } from "./AddUserForm";
import { UserList } from "./UserList";
import { useUserList } from "./useUserList";

function ListOrNothing({ l, saving }: { l: ReturnType<typeof useUserList>; saving: boolean }) {
  if (l.me === undefined || l.users === undefined) return null;
  return <UserList me={l.me} users={l.users} busy={saving} onToggle={l.request} />;
}

export function UsersScreen() {
  const l = useUserList();
  const saving = l.mutation.status === "saving";
  return (
    <main className="mx-auto grid max-w-3xl gap-4 p-4 sm:p-6">
      <h1 className="text-2xl font-semibold">Users</h1>
      {l.me !== undefined && <AddUserForm me={l.me} />}
      {l.isLoading && <PageSkeleton />}
      {l.error !== undefined && (
        <p role="alert" className="text-danger">
          {l.error.message}
        </p>
      )}
      {l.pending === null && l.mutation.status === "error" && (
        <SaveState status="error" error={l.mutation.error} onRetry={l.retry} />
      )}
      {l.users?.length === 0 && <EmptyState icon={UsersIcon} title="No users yet" />}
      <ListOrNothing l={l} saving={saving} />
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
