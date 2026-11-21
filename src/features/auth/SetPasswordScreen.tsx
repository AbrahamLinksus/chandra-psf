"use client";

import { useState, type SubmitEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DemoLabel } from "@/components/shared/DemoLabel";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { SaveState } from "@/components/shared/SaveState";
import { MIN_PASSWORD_LENGTH } from "@/domain/constants";
import { useSetPassword } from "./useSetPassword";

export function SetPasswordScreen() {
  const { ready, problem, mutation, submit } = useSetPassword();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  if (!ready) return <PageSkeleton />;

  const onSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    void submit(password, confirm);
  };

  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-md content-center gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Set your password</h1>
        <DemoLabel />
      </div>
      <form onSubmit={onSubmit} className="grid gap-4 rounded-2xl border bg-card p-4 shadow-sm">
        <p className="text-sm text-muted-foreground">
          Choose a new password of at least {MIN_PASSWORD_LENGTH} characters.
        </p>
        <div className="grid gap-2">
          <Label htmlFor="new-password">New password</Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            className="h-12"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
            }}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="confirm-password">Confirm password</Label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            className="h-12"
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
            }}
          />
        </div>
        {problem !== null && (
          <p role="alert" className="text-danger text-sm">
            {problem}
          </p>
        )}
        <SaveState
          status={mutation.status}
          error={mutation.error}
          onRetry={() => void submit(password, confirm)}
        />
        <Button type="submit" className="h-12" disabled={mutation.status === "saving"}>
          Save
        </Button>
      </form>
    </main>
  );
}
