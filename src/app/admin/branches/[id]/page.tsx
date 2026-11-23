import { RoleGuard } from "@/components/shared/RoleGuard";
import { BranchAdvisorsScreen } from "@/features/admin-branches/BranchAdvisorsScreen";

export default async function AdminBranchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RoleGuard allowed={["main_admin"]}>
      <BranchAdvisorsScreen branchId={id} />
    </RoleGuard>
  );
}
