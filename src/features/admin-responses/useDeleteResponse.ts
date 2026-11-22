"use client";

import { useState } from "react";
import { useRepoMutation } from "@/hooks/useRepoMutation";

/** Delete flow: confirm first, then the password prompt. */
export function useDeleteResponse(id: string) {
  const [step, setStep] = useState<"idle" | "confirm" | "password">("idle");
  const mutation = useRepoMutation((da, password: string) =>
    da.responses.deleteResponse(id, { password }),
  );
  return {
    step,
    askConfirm: () => {
      setStep("confirm");
    },
    askPassword: () => {
      setStep("password");
    },
    close: () => {
      setStep("idle");
      mutation.reset();
    },
    remove: (password: string) => mutation.run(password),
  };
}
