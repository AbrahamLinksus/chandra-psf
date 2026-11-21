"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DemoLabel } from "@/components/shared/DemoLabel";
import { ResetDemoDialog } from "@/components/shared/ResetDemoDialog";
import { CredentialsForm } from "./CredentialsForm";
import { useSignIn, type DemoWho } from "./useSignIn";

const PICKERS: { who: DemoWho; label: string }[] = [
  { who: "admin", label: "Sign in as Admin" },
  { who: "support1", label: "Sign in as Support 1" },
  { who: "support2", label: "Sign in as Support 2" },
];

export function SignInScreen() {
  const { busy, error, signInWithPassword, signInAsDemo } = useSignIn();
  const [resetOpen, setResetOpen] = useState(false);

  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-md content-center gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <DemoLabel />
      </div>
      <section aria-label="Quick sign in" className="grid gap-2">
        {PICKERS.map(({ who, label }) => (
          <Button
            key={who}
            variant={who === "admin" ? "default" : "outline"}
            className="h-12 w-full"
            disabled={busy}
            onClick={() => void signInAsDemo(who)}
          >
            {label}
          </Button>
        ))}
      </section>
      <CredentialsForm busy={busy} error={error} onSubmit={signInWithPassword} />
      <Button
        variant="link"
        className="justify-self-center"
        onClick={() => {
          setResetOpen(true);
        }}
      >
        Reset demo data
      </Button>
      <ResetDemoDialog
        open={resetOpen}
        onClose={() => {
          setResetOpen(false);
        }}
      />
    </main>
  );
}
