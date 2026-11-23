import type { ReactNode } from "react";
import { AdminShell } from "@/components/shared/AdminShell";
import { RoleGuard } from "@/components/shared/RoleGuard";

const ADMIN_ROLES = ["branch_admin", "main_admin"] as const;

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard allowed={ADMIN_ROLES}>
      <AdminShell>{children}</AdminShell>
    </RoleGuard>
  );
}
