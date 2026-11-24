"use client";

import { useState, type SyntheticEvent } from "react";
import type { User } from "@/domain/types";
import { useUsersMutation } from "./useUsersMutation";
import { mergeUser } from "./listCache";
import { pickerConfig } from "./pickerConfig";
import { useBranchOptions } from "./useBranchOptions";
import { canMove } from "./userPermissions";
import {
  draftFromUser,
  isFieldError,
  toFieldErrors,
  type DraftKey,
  type FieldErrors,
  type UserDraft,
} from "./userForm";

type Patch = { name?: string; email?: string; role?: User["role"]; branchId?: string | null };

/** Only the fields that changed; role/branch only when the signed-in admin may move this user. */
function buildPatch(user: User, d: UserDraft, moves: boolean): Patch {
  const patch: Patch = {};
  if (d.name !== user.name) patch.name = d.name;
  if (d.email !== user.email) patch.email = d.email;
  if (!moves) return patch;
  const branchId = d.role === "main_admin" ? null : d.branchId === "" ? null : d.branchId;
  if (d.role !== user.role) patch.role = d.role;
  if (branchId !== user.branchId) patch.branchId = branchId;
  return patch;
}

/** Edit-user dialog state (G-9); closes on success, keeps the draft on failure. */
export function useEditUser(me: User, user: User, onDone: () => void) {
  const [draft, setDraft] = useState<UserDraft>(draftFromUser(user));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const moves = canMove(me, user);
  const branches = useBranchOptions(moves);
  const config = pickerConfig(me, draft, branches.options, branches.isLoading);
  const mutation = useUsersMutation(
    (da, patch: Patch) => da.users.updateUser(user.id, patch),
    mergeUser,
  );

  const setField = (key: DraftKey, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const submit = async () => {
    setFieldErrors({});
    const result = await mutation.run(buildPatch(user, draft, moves));
    if (result.ok) {
      onDone();
      return;
    }
    if (isFieldError(result.error)) {
      setFieldErrors(toFieldErrors(result.error));
      mutation.reset();
    }
  };

  const onSubmit = (e: SyntheticEvent) => {
    e.preventDefault();
    if (!(moves && config.noBranches)) void submit();
  };

  return { draft, setField, fieldErrors, config, moves, mutation, onSubmit, retry: submit };
}
