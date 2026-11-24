"use client";

import { SaveState } from "@/components/shared/SaveState";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { User } from "@/domain/types";
import { RoleBranchPickers } from "./RoleBranchPickers";
import { TextField } from "./UserFields";
import { useEditUser } from "./useEditUser";

export interface EditUserDialogProps {
  me: User;
  user: User;
  onClose: () => void;
}

function EditUserForm({ me, user, onClose }: EditUserDialogProps) {
  const e = useEditUser(me, user, onClose);
  return (
    <form noValidate onSubmit={e.onSubmit} className="grid gap-4">
      <TextField
        id="edit-user-name"
        label="Name"
        type="text"
        value={e.draft.name}
        error={e.fieldErrors.name}
        onChange={(v) => {
          e.setField("name", v);
        }}
      />
      <TextField
        id="edit-user-email"
        label="Email"
        type="email"
        value={e.draft.email}
        error={e.fieldErrors.email}
        onChange={(v) => {
          e.setField("email", v);
        }}
      />
      {e.moves && (
        <RoleBranchPickers
          idPrefix="edit-user"
          draft={e.draft}
          errors={e.fieldErrors}
          config={e.config}
          onChange={e.setField}
        />
      )}
      <SaveState
        status={e.mutation.status}
        error={e.mutation.error}
        onRetry={() => void e.retry()}
      />
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" className="h-12" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          className="h-12"
          disabled={e.mutation.status === "saving" || (e.moves && e.config.noBranches)}
        >
          Save changes
        </Button>
      </div>
    </form>
  );
}

export function EditUserDialog({ me, user, onClose }: EditUserDialogProps) {
  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {user.name}</DialogTitle>
          <DialogDescription>
            A role or branch change signs this person out everywhere.
          </DialogDescription>
        </DialogHeader>
        <EditUserForm me={me} user={user} onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}
