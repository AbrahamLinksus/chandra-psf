"use client";

import { useState, type SyntheticEvent } from "react";
import type { User } from "@/domain/types";
import { useUsersMutation } from "./useUsersMutation";
import { isFieldError } from "./userForm";

/**
 * Reset-password state (US-27). The temporary password lives only in this hook's state:
 * shown once on the confirmation screen, gone when the dialog closes.
 */
export function useResetPassword(user: User) {
  const [password, setPassword] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const [shown, setShown] = useState<string | null>(null);
  const mutation = useUsersMutation((da, pw: string) => da.users.resetPassword(user.id, pw));

  const submit = async () => {
    setFieldError(undefined);
    const result = await mutation.run(password);
    if (result.ok) {
      setShown(password);
      setPassword("");
      return;
    }
    if (isFieldError(result.error)) {
      setFieldError(result.error.message);
      mutation.reset();
    }
  };

  const onSubmit = (e: SyntheticEvent) => {
    e.preventDefault();
    void submit();
  };

  return { password, setPassword, fieldError, shown, mutation, onSubmit, retry: submit };
}
