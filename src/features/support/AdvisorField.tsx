import { FormField, SELECT_CLASS } from "./FormField";
import { NO_ADVISORS } from "./messages";

interface Props {
  value: string;
  advisors: { id: string; name: string }[];
  disabled: boolean;
  error: string | undefined;
  onChange: (v: string) => void;
}

/** Advisor pick list; with no active advisors it says whom to ask. */
export function AdvisorField({ value, advisors, disabled, error, onChange }: Props) {
  return (
    <>
      <FormField id="advisorId" label="Advisor" error={error}>
        <select
          id="advisorId"
          className={SELECT_CLASS}
          value={value}
          disabled={disabled}
          onChange={(e) => {
            onChange(e.target.value);
          }}
        >
          <option value="">Pick an advisor</option>
          {advisors.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </FormField>
      {disabled && <p className="text-sm text-danger">{NO_ADVISORS}</p>}
    </>
  );
}
