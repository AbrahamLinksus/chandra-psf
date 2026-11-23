import type { ReactNode } from "react";
import { RoleGuard } from "@/components/shared/RoleGuard";
import { SupportShell } from "@/components/shared/SupportShell";

const SUPPORT_ROLES = ["support"] as const;

export default function SupportLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard allowed={SUPPORT_ROLES}>
      <SupportShell>{children}</SupportShell>
    </RoleGuard>
  );
}
