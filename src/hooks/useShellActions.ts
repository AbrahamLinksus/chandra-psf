"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { toast } from "sonner";
import { useDataAccess } from "@/data/access/provider";

/** Sign out, used by both shells. */
export function useShellActions(): { signOut: () => Promise<void> } {
  const da = useDataAccess();
  const router = useRouter();

  const signOut = useCallback(async () => {
    const result = await da.auth.signOut();
    if (result.ok) router.replace("/sign-in");
    else toast.error(result.error.message);
  }, [da, router]);

  return { signOut };
}
