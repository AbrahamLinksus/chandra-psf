import type { ReactNode } from "react";
import { RoleGuard } from "@/components/shared/RoleGuard";
import { SupportShell } from "@/components/shared/SupportShell";

export default function SupportLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard role="support">
      <SupportShell>{children}</SupportShell>
    </RoleGuard>
  );
}
