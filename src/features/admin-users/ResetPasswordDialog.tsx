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
import { TextField } from "./UserFields";
import { useResetPassword } from "./useResetPassword";

export interface ResetPasswordDialogProps {
  user: User;
  onClose: () => void;
}

function Confirmation({ user, shown, onClose }: ResetPasswordDialogProps & { shown: string }) {
  return (
    <div className="grid gap-4" data-testid="reset-confirmation">
      <p role="status">
        {user.name} is signed out everywhere. Their next sign-in asks them to set a new password.
      </p>
      <div className="grid gap-1 rounded-xl border p-3">
        <span className="text-sm text-muted-foreground">Temporary password (shown once)</span>
        <code className="text-lg font-semibold break-all">{shown}</code>
      </div>
      <Button type="button" className="h-12" onClick={onClose}>
        Done
      </Button>
    </div>
  );
}

function ResetForm({ user, onClose }: ResetPasswordDialogProps) {
  const r = useResetPassword(user);
  if (r.shown !== null) return <Confirmation user={user} shown={r.shown} onClose={onClose} />;
  return (
    <form noValidate onSubmit={r.onSubmit} className="grid gap-4">
      <TextField
        id="reset-password-temp"
        label="Temporary password"
        type="text"
        value={r.password}
        error={r.fieldError}
        onChange={r.setPassword}
      />
      <SaveState
        status={r.mutation.status}
        error={r.mutation.error}
        onRetry={() => void r.retry()}
      />
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" className="h-12" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" className="h-12" disabled={r.mutation.status === "saving"}>
          Reset password
        </Button>
      </div>
    </form>
  );
}

export function ResetPasswordDialog({ user, onClose }: ResetPasswordDialogProps) {
  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password for {user.name}</DialogTitle>
          <DialogDescription>
            Type a temporary password. They are signed out now and must choose their own password at
            next sign-in.
          </DialogDescription>
        </DialogHeader>
        <ResetForm user={user} onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}
