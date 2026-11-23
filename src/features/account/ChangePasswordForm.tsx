"use client";

import { useState, type SubmitEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SaveState } from "@/components/shared/SaveState";
import { useChangePassword } from "./useChangePassword";

interface FieldProps {
  id: string;
  label: string;
  autoComplete: string;
  value: string;
  onChange: (v: string) => void;
}

function PasswordField({ id, label, autoComplete, value, onChange }: FieldProps) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="password"
        autoComplete={autoComplete}
        className="h-12"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
      />
    </div>
  );
}

export function ChangePasswordForm() {
  const { problem, mutation, submit } = useChangePassword();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  const run = async () => {
    if (await submit(current, next, confirm)) {
      setCurrent("");
      setNext("");
      setConfirm("");
    }
  };
  const onSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    void run();
  };

  return (
    <form onSubmit={onSubmit} className="grid gap-4 rounded-2xl border bg-card p-4">
      <h2 className="text-lg font-semibold">Change password</h2>
      <PasswordField
        id="current-password"
        label="Current password"
        autoComplete="current-password"
        value={current}
        onChange={setCurrent}
      />
      <PasswordField
        id="new-password"
        label="New password"
        autoComplete="new-password"
        value={next}
        onChange={setNext}
      />
      <PasswordField
        id="confirm-password"
        label="Confirm new password"
        autoComplete="new-password"
        value={confirm}
        onChange={setConfirm}
      />
      {problem !== null && (
        <p role="alert" className="text-sm text-danger">
          {problem}
        </p>
      )}
      <SaveState status={mutation.status} error={mutation.error} onRetry={() => void run()} />
      {mutation.status === "done" && (
        <p role="status" className="text-sm text-success">
          Password changed. Your other sessions were signed out.
        </p>
      )}
      <Button type="submit" className="h-12" disabled={mutation.status === "saving"}>
        Change password
      </Button>
    </form>
  );
}
