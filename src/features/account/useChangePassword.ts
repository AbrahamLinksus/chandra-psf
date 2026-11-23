"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MIN_PASSWORD_LENGTH } from "@/domain/constants";
import { useRepoMutation } from "@/hooks/useRepoMutation";
import { SESSION_KEY } from "@/hooks/useSession";
import type { DataAccess } from "@/data/access";
import { signInUrl } from "@/lib/signInUrl";

interface Input {
  current: string;
  next: string;
}

const save = (da: DataAccess, input: Input) => da.auth.changePassword(input.current, input.next);

/** Client-side check; the repo validates again. Null means valid. */
export function changePasswordProblem(
  current: string,
  next: string,
  confirm: string,
): string | null {
  if (current.length === 0) return "Enter your current password";
  if (next.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${String(MIN_PASSWORD_LENGTH)} characters`;
  }
  if (next !== confirm) return "The two passwords don't match";
  return null;
}

export function useChangePassword() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const mutation = useRepoMutation(save);
  const [problem, setProblem] = useState<string | null>(null);

  const submit = async (current: string, next: string, confirm: string): Promise<boolean> => {
    const found = changePasswordProblem(current, next, confirm);
    setProblem(found);
    if (found !== null) {
      mutation.reset();
      return false;
    }
    const result = await mutation.run({ current, next });
    if (result.ok) return true;
    if (result.error.code === "UNAUTHENTICATED") {
      await queryClient.invalidateQueries({ queryKey: SESSION_KEY, refetchType: "all" });
      router.replace(signInUrl(null, true));
    }
    return false;
  };

  return { problem, mutation, submit };
}
