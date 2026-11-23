"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/useSession";
import { useShellActions } from "@/hooks/useShellActions";
import Link from "next/link";

export function SupportShell({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const { signOut } = useShellActions();
  return (
    <div className="min-h-screen bg-secondary/40">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-card px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="font-semibold">Chandra Honda PSF</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/account"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            My account
          </Link>
          <span className="text-sm text-muted-foreground">{user?.name}</span>
          <Button variant="outline" className="h-12" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </header>
      {children}
    </div>
  );
}
