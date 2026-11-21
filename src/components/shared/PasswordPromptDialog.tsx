"use client";

import { useState, type SyntheticEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Result } from "@/data/access";

export interface PasswordPromptDialogProps {
  open: boolean;
  title: string;
  onConfirm: (password: string) => Promise<Result<unknown>>;
  onClose: () => void;
}

/** Step-up prompt: shows "Password incorrect" on BAD_PASSWORD, keeps the dialog open. */
export function PasswordPromptDialog({
  open,
  title,
  onConfirm,
  onClose,
}: PasswordPromptDialogProps) {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setPassword("");
    setMessage(null);
    onClose();
  };

  const submit = async (e: SyntheticEvent) => {
    e.preventDefault();
    setBusy(true);
    let result: Awaited<ReturnType<typeof onConfirm>>;
    try {
      result = await onConfirm(password);
    } finally {
      setBusy(false);
    }
    if (result.ok) {
      close();
      return;
    }
    setMessage(result.error.code === "BAD_PASSWORD" ? "Password incorrect" : result.error.message);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogContent>
        <form onSubmit={(e) => void submit(e)} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>Enter your password to continue.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="step-up-password">Password</Label>
            <Input
              id="step-up-password"
              type="password"
              autoComplete="current-password"
              className="h-12"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
              }}
              aria-invalid={message !== null}
            />
            {message !== null && (
              <p role="alert" className="text-sm text-danger">
                {message}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="h-12" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" className="h-12" disabled={busy || password === ""}>
              Confirm
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
