import type { ReactNode } from "react";
import { AccountShell } from "@/components/shared/AccountShell";
import { RoleGuard } from "@/components/shared/RoleGuard";

const ALL_ROLES = ["support", "branch_admin", "main_admin"] as const;

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard allowed={ALL_ROLES}>
      <AccountShell>{children}</AccountShell>
    </RoleGuard>
  );
}
