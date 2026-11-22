"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MIN_PASSWORD_LENGTH } from "@/domain/constants";
import { useRepoMutation } from "@/hooks/useRepoMutation";
import { SESSION_KEY, useSession } from "@/hooks/useSession";
import type { DataAccess } from "@/data/access";
import { landingPath } from "./routes";

const save = (da: DataAccess, password: string) => da.auth.setOwnPassword(password);

/** Client-side check; the repo validates length again. Null means valid. */
export function passwordProblem(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${String(MIN_PASSWORD_LENGTH)} characters`;
  }
  if (password !== confirm) return "The two passwords don't match";
  return null;
}

export function useSetPassword() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isLoading } = useSession();
  const mutation = useRepoMutation(save);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (user === null) router.replace("/sign-in");
    else if (!user.mustSetPassword && mutation.status !== "done") {
      router.replace(landingPath(user));
    }
  }, [user, isLoading, router, mutation.status]);

  const submit = async (password: string, confirm: string) => {
    const found = passwordProblem(password, confirm);
    setProblem(found);
    if (found !== null) return;
    const result = await mutation.run(password);
    if (!result.ok) return;
    await queryClient.invalidateQueries({ queryKey: SESSION_KEY, refetchType: "all" });
    if (user !== null) router.replace(landingPath({ ...user, mustSetPassword: false }));
  };

  const ready = !isLoading && user !== null && user.mustSetPassword;
  return { ready, problem, mutation, submit };
}
