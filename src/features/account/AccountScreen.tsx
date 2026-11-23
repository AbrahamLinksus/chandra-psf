"use client";

import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { useSession } from "@/hooks/useSession";
import { AccountDetails } from "./AccountDetails";
import { ChangePasswordForm } from "./ChangePasswordForm";

export function AccountScreen() {
  const { user, isLoading } = useSession();
  if (isLoading) return <PageSkeleton />;
  return (
    <div className="mx-auto grid w-full max-w-xl gap-6 p-4 sm:p-6">
      <h1 className="text-2xl font-semibold">My account</h1>
      {user === null ? (
        <p role="alert" className="text-sm text-danger">
          Couldn&apos;t load your account. Refresh to try again.
        </p>
      ) : (
        <AccountDetails user={user} />
      )}
      <ChangePasswordForm />
    </div>
  );
}
