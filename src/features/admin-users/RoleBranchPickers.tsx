import type { PickerConfig } from "./pickerConfig";
import type { DraftKey, FieldErrors, UserDraft } from "./userForm";
import { PickerField } from "./UserFields";

export interface RoleBranchPickersProps {
  idPrefix: string;
  draft: UserDraft;
  errors: FieldErrors;
  config: PickerConfig;
  onChange: (key: DraftKey, value: string) => void;
}

export function RoleBranchPickers({
  idPrefix,
  draft,
  errors,
  config,
  onChange,
}: RoleBranchPickersProps) {
  return (
    <>
      <PickerField
        id={`${idPrefix}-role`}
        label="Role"
        value={draft.role}
        options={config.roles}
        error={errors.role}
        onChange={(v) => {
          onChange("role", v);
        }}
      />
      {config.showBranch && (
        <PickerField
          id={`${idPrefix}-branch`}
          label="Branch"
          value={draft.branchId}
          options={config.branches}
          locked={config.branchLocked}
          error={errors.branchId}
          onChange={(v) => {
            onChange("branchId", v);
          }}
        />
      )}
      {config.noBranches && (
        <p role="alert" className="text-sm text-danger">
          Add a branch first
        </p>
      )}
    </>
  );
}
