import type { ReactNode } from "react";
import { AdminShell } from "@/components/shared/AdminShell";
import { RoleGuard } from "@/components/shared/RoleGuard";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard role="admin">
      <AdminShell>{children}</AdminShell>
    </RoleGuard>
  );
}
