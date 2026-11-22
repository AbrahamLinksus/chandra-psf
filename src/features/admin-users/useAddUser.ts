"use client";

import { useState, type SyntheticEvent } from "react";
import { useRepoMutation } from "@/hooks/useRepoMutation";

export interface AddUserDraft {
  name: string;
  email: string;
  tempPassword: string;
}

export type FieldErrors = Partial<Record<keyof AddUserDraft, string>>;

const EMPTY: AddUserDraft = { name: "", email: "", tempPassword: "" };
const FIELD_MESSAGES: Record<keyof AddUserDraft, string> = {
  name: "Enter a name",
  email: "Enter a valid email address",
  tempPassword: "Use at least 8 characters",
};

function toFieldErrors(fields: string[] | undefined, emailInUse: boolean): FieldErrors {
  const errors: FieldErrors = {};
  for (const f of fields ?? []) {
    if (f === "name" || f === "email" || f === "tempPassword") errors[f] = FIELD_MESSAGES[f];
  }
  if (emailInUse) errors.email = "Email already in use";
  return errors;
}

/** Add-user form state; the draft is kept when a save fails and cleared on success (S-13). */
export function useAddUser() {
  const [draft, setDraft] = useState<AddUserDraft>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const mutation = useRepoMutation((da, input: AddUserDraft) => da.users.createSupportUser(input));

  const setField = (key: keyof AddUserDraft, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const submit = async () => {
    setFieldErrors({});
    const result = await mutation.run(draft);
    if (result.ok) {
      setDraft(EMPTY);
      return;
    }
    const { code, fields } = result.error;
    if (code === "VALIDATION" || code === "EMAIL_IN_USE") {
      setFieldErrors(toFieldErrors(fields, code === "EMAIL_IN_USE"));
      mutation.reset();
    }
  };

  const onSubmit = (e: SyntheticEvent) => {
    e.preventDefault();
    void submit();
  };

  return { draft, setField, fieldErrors, mutation, onSubmit, retry: submit };
}
