"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useDataAccess } from "@/data/access/provider";
import type { Result } from "@/data/access";
import type { User } from "@/domain/types";
import { landingPath } from "./routes";

export type DemoWho = "admin" | "support1" | "support2";

export interface SignInState {
  busy: boolean;
  error: string | null;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signInAsDemo: (who: DemoWho) => Promise<void>;
}

export function useSignIn(): SignInState {
  const da = useDataAccess();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = useCallback(
    async (result: Result<User>) => {
      if (result.ok) {
        // Refresh inactive cached sessions too, or RoleGuard sees a stale null.
        await queryClient.invalidateQueries({ queryKey: ["session"], refetchType: "all" });
        router.replace(landingPath(result.value));
      } else setError(result.error.message);
      setBusy(false);
    },
    [router, queryClient],
  );

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      setBusy(true);
      setError(null);
      await finish(await da.auth.signIn(email, password));
    },
    [da, finish],
  );

  const signInAsDemo = useCallback(
    async (who: DemoWho) => {
      setBusy(true);
      setError(null);
      await finish(await da.auth.signInAsDemo(who));
    },
    [da, finish],
  );

  return { busy, error, signInWithPassword, signInAsDemo };
}
