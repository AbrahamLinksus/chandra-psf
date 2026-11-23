import { RoleGuard } from "@/components/shared/RoleGuard";
import { AdvisorsScreen } from "@/features/admin-branches/AdvisorsScreen";

export default function AdminAdvisorsPage() {
  return (
    <RoleGuard allowed={["branch_admin"]}>
      <AdvisorsScreen />
    </RoleGuard>
  );
}
