"use client";

import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { SaveState } from "@/components/shared/SaveState";
import { useRepoMutation } from "@/hooks/useRepoMutation";
import type { DataAccess } from "@/data/access";

const reset = (da: DataAccess) => da.demo.resetDemoData();

export function ResetDemoDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const mutation = useRepoMutation(reset);

  const confirm = async () => {
    const result = await mutation.run(undefined);
    if (!result.ok) return;
    onClose();
    router.replace("/sign-in");
  };

  return (
    <ConfirmDialog
      open={open}
      title="Reset demo data?"
      body="Reset all demo data? Every link, response, alert, user and audit entry made in this browser is lost."
      confirmLabel="Reset"
      destructive
      status={
        <SaveState status={mutation.status} error={mutation.error} onRetry={() => void confirm()} />
      }
      onConfirm={() => void confirm()}
      onClose={() => {
        mutation.reset();
        onClose();
      }}
    />
  );
}
