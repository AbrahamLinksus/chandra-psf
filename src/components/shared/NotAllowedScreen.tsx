"use client";

import Link from "next/link";
import { ShieldAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/useSession";
import { EmptyState } from "./EmptyState";

const HOME: Record<string, string> = { admin: "/admin", support: "/support" };

export function NotAllowedScreen() {
  const { user } = useSession();
  const home = user === null ? "/sign-in" : (HOME[user.role] ?? "/sign-in");
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center p-6">
      <EmptyState icon={ShieldAlertIcon} title="You don't have access to this page" />
      <Button asChild className="h-12">
        <Link href={home}>{user === null ? "Go to sign in" : "Back to my home"}</Link>
      </Button>
    </main>
  );
}
