"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { useDataAccess } from "@/data/access/provider";
import type { Result } from "@/data/access";
import type { User } from "@/domain/types";
import { SESSION_KEY } from "@/hooks/useSession";
import { postSignInPath } from "./routes";

export interface SignInState {
  busy: boolean;
  error: string | null;
  signInWithPassword: (email: string, password: string) => Promise<void>;
}

export function useSignIn(): SignInState {
  const da = useDataAccess();
  const router = useRouter();
  const next = useSearchParams().get("next");
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = useCallback(
    async (result: Result<User>) => {
      if (result.ok) {
        // Refresh inactive cached sessions too, or RoleGuard sees a stale null.
        await queryClient.invalidateQueries({ queryKey: SESSION_KEY, refetchType: "all" });
        router.replace(postSignInPath(result.value, next));
      } else setError(result.error.message);
      setBusy(false);
    },
    [router, queryClient, next],
  );

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      setBusy(true);
      setError(null);
      await finish(await da.auth.signIn(email, password));
    },
    [da, finish],
  );

  return { busy, error, signInWithPassword };
}
