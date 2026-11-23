"use client";

import { CredentialsForm } from "./CredentialsForm";
import { useSignIn } from "./useSignIn";

export function SignInScreen() {
  const { busy, error, signInWithPassword } = useSignIn();
  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-md content-center gap-6 p-4 sm:p-6">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <CredentialsForm busy={busy} error={error} onSubmit={signInWithPassword} />
    </main>
  );
}
