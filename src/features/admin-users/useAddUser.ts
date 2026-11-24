"use client";

import { useState, type SyntheticEvent } from "react";
import type { User } from "@/domain/types";
import { useUsersMutation } from "./useUsersMutation";
import { pickerConfig } from "./pickerConfig";
import { useBranchOptions } from "./useBranchOptions";
import {
  EMPTY_DRAFT,
  isFieldError,
  toFieldErrors,
  type DraftKey,
  type FieldErrors,
} from "./userForm";
import type { UserDraft } from "./userForm";

/** The draft as the signed-in admin may submit it: a branch admin is fixed to Support in own branch. */
function effectiveDraft(me: User, draft: UserDraft): UserDraft {
  if (me.role === "main_admin") return draft;
  return { ...draft, role: "support", branchId: me.branchId ?? "" };
}

/** Add-user form state; the draft is kept when a save fails and cleared on success (S-13). */
export function useAddUser(me: User) {
  const [raw, setDraft] = useState<UserDraft>(EMPTY_DRAFT);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const branches = useBranchOptions(me.role === "main_admin");
  const draft = effectiveDraft(me, raw);
  const config = pickerConfig(me, draft, branches.options, branches.isLoading);
  const mutation = useUsersMutation((da, d: UserDraft) =>
    da.users.createUser({
      name: d.name,
      email: d.email,
      tempPassword: d.tempPassword,
      role: d.role,
      branchId: d.role === "main_admin" ? null : d.branchId === "" ? null : d.branchId,
    }),
  );

  const setField = (key: DraftKey, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const submit = async () => {
    setFieldErrors({});
    const result = await mutation.run(draft);
    if (result.ok) {
      setDraft(EMPTY_DRAFT);
      return;
    }
    if (isFieldError(result.error)) {
      setFieldErrors(toFieldErrors(result.error));
      mutation.reset();
    }
  };

  const onSubmit = (e: SyntheticEvent) => {
    e.preventDefault();
    if (!config.noBranches) void submit();
  };

  return { draft, setField, fieldErrors, config, mutation, onSubmit, retry: submit };
}
