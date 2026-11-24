"use client";

import { SaveState } from "@/components/shared/SaveState";
import { Button } from "@/components/ui/button";
import type { User } from "@/domain/types";
import { RoleBranchPickers } from "./RoleBranchPickers";
import { TextField } from "./UserFields";
import { useAddUser } from "./useAddUser";

export function AddUserForm({ me }: { me: User }) {
  const {
    draft,
    setField,
    fieldErrors: errors,
    config,
    mutation,
    onSubmit,
    retry,
  } = useAddUser(me);
  return (
    <form noValidate onSubmit={onSubmit} className="grid gap-4 rounded-xl border p-4">
      <h2 className="text-lg font-semibold">Add user</h2>
      <TextField
        id="add-user-name"
        label="Name"
        type="text"
        value={draft.name}
        error={errors.name}
        onChange={(v) => {
          setField("name", v);
        }}
      />
      <TextField
        id="add-user-email"
        label="Email"
        type="email"
        value={draft.email}
        error={errors.email}
        onChange={(v) => {
          setField("email", v);
        }}
      />
      <RoleBranchPickers
        idPrefix="add-user"
        draft={draft}
        errors={errors}
        config={config}
        onChange={setField}
      />
      <TextField
        id="add-user-tempPassword"
        label="Temporary password"
        type="text"
        value={draft.tempPassword}
        error={errors.tempPassword}
        onChange={(v) => {
          setField("tempPassword", v);
        }}
      />
      <SaveState status={mutation.status} error={mutation.error} onRetry={() => void retry()} />
      <Button
        type="submit"
        className="h-12 sm:w-fit"
        disabled={mutation.status === "saving" || config.noBranches}
      >
        Add user
      </Button>
    </form>
  );
}
