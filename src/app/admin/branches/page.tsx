import { RoleGuard } from "@/components/shared/RoleGuard";
import { BranchesScreen } from "@/features/admin-branches/BranchesScreen";

export default function AdminBranchesPage() {
  return (
    <RoleGuard allowed={["main_admin"]}>
      <BranchesScreen />
    </RoleGuard>
  );
}
