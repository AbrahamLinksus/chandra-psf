"use client";

import { useState, type SubmitEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { env } from "@/config/env";

interface Props {
  busy: boolean;
  error: string | null;
  onSubmit: (email: string, password: string) => Promise<void>;
}

export function CredentialsForm({ busy, error, onSubmit }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submit = (e: SubmitEvent) => {
    e.preventDefault();
    void onSubmit(email, password);
  };

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-2xl border bg-card p-4 shadow-sm">
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          className="h-12"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
          }}
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          className="h-12"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
          }}
          required
        />
      </div>
      {error !== null && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <Button type="submit" className="h-12" disabled={busy}>
        Sign in
      </Button>
      <p className="text-sm text-muted-foreground">
        Demo password for the sample accounts: <code>{env.NEXT_PUBLIC_DEMO_PASSWORD}</code>
      </p>
    </form>
  );
}
