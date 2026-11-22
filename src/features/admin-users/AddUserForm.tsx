"use client";

import { SaveState } from "@/components/shared/SaveState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAddUser, type AddUserDraft, type FieldErrors } from "./useAddUser";

const FIELDS: { key: keyof AddUserDraft; label: string; type: string; autoComplete: string }[] = [
  { key: "name", label: "Name", type: "text", autoComplete: "off" },
  { key: "email", label: "Email", type: "email", autoComplete: "off" },
  { key: "tempPassword", label: "Temporary password", type: "text", autoComplete: "off" },
];

function Field(props: {
  field: (typeof FIELDS)[number];
  value: string;
  error: string | undefined;
  onChange: (v: string) => void;
}) {
  const { field, value, error, onChange } = props;
  const id = `add-user-${field.key}`;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{field.label}</Label>
      <Input
        id={id}
        type={field.type}
        autoComplete={field.autoComplete}
        value={value}
        aria-invalid={error !== undefined}
        aria-describedby={error === undefined ? undefined : `${id}-error`}
        className="h-12"
        onChange={(e) => {
          onChange(e.target.value);
        }}
      />
      {error !== undefined && (
        <p id={`${id}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function AddUserForm() {
  const { draft, setField, fieldErrors, mutation, onSubmit, retry } = useAddUser();
  const errors: FieldErrors = fieldErrors;
  return (
    <form noValidate onSubmit={onSubmit} className="grid gap-4 rounded-xl border p-4">
      <h2 className="text-lg font-semibold">Add support user</h2>
      {FIELDS.map((f) => (
        <Field
          key={f.key}
          field={f}
          value={draft[f.key]}
          error={errors[f.key]}
          onChange={(v) => {
            setField(f.key, v);
          }}
        />
      ))}
      <SaveState status={mutation.status} error={mutation.error} onRetry={() => void retry()} />
      <Button type="submit" className="h-12 sm:w-fit" disabled={mutation.status === "saving"}>
        Add support user
      </Button>
    </form>
  );
}
