"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface EraseDialogProps {
  count: number;
  busy: boolean;
  error: string | undefined;
  onConfirm: (password: string) => void;
  onClose: () => void;
}

export function EraseDialog({ count, busy, error, onConfirm, onClose }: EraseDialogProps) {
  const [password, setPassword] = useState("");
  const rows = `${String(count)} ${count === 1 ? "row" : "rows"}`;
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent data-testid="erase-dialog">
        <DialogHeader>
          <DialogTitle>Erase customer data?</DialogTitle>
          <DialogDescription>
            This can&apos;t be undone. Name, phone and registration number are removed for {rows}.
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            onConfirm(password);
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="erase-password">Your password</Label>
            <Input
              id="erase-password"
              type="password"
              autoComplete="current-password"
              className="h-12"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
              }}
            />
          </div>
          {error !== undefined && (
            <p role="alert" className="text-danger">
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" className="h-12" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              className="h-12"
              disabled={busy || password === ""}
            >
              Confirm erase
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
