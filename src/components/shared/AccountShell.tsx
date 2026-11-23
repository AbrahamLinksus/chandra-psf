"use client";

import type { ReactNode } from "react";
import { isAdmin } from "@/domain/roles";
import { useSession } from "@/hooks/useSession";
import { AdminShell } from "./AdminShell";
import { SupportShell } from "./SupportShell";

/** My account lives in both portals: it takes the shell of the signed-in role. */
export function AccountShell({ children }: { children: ReactNode }) {
  const { user } = useSession();
  return user !== null && isAdmin(user.role) ? (
    <AdminShell>{children}</AdminShell>
  ) : (
    <SupportShell>{children}</SupportShell>
  );
}
