"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { toast } from "sonner";
import { useDataAccess } from "@/data/access/provider";

/** Sign out and the demo "simulate failed save" switch used by both shells. */
export function useShellActions(): {
  signOut: () => Promise<void>;
  simulateFailedSave: () => Promise<void>;
} {
  const da = useDataAccess();
  const router = useRouter();

  const signOut = useCallback(async () => {
    const result = await da.auth.signOut();
    if (result.ok) router.replace("/sign-in");
    else toast.error(result.error.message);
  }, [da, router]);

  const simulateFailedSave = useCallback(async () => {
    const result = await da.demo.armFailedSave();
    if (result.ok) toast.success("The next save will fail");
    else toast.error(result.error.message);
  }, [da]);

  return { signOut, simulateFailedSave };
}
