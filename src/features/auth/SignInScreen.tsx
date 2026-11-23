"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CredentialsForm } from "./CredentialsForm";
import { useSignIn } from "./useSignIn";

function SignInContent() {
  const { busy, error, signInWithPassword } = useSignIn();
  const ended = useSearchParams().get("ended") === "1";
  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-md content-center gap-6 p-4 sm:p-6">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      {ended && (
        <p role="status" className="rounded-lg border bg-muted p-3 text-sm">
          Your session has ended. Sign in again.
        </p>
      )}
      <CredentialsForm busy={busy} error={error} onSubmit={signInWithPassword} />
      <p className="text-sm text-muted-foreground">
        Forgot your password? Ask your admin to reset it.
      </p>
    </main>
  );
}

export function SignInScreen() {
  return (
    <Suspense>
      <SignInContent />
    </Suspense>
  );
}
