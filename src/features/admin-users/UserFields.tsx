import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function FieldError({ id, error }: { id: string; error: string | undefined }) {
  if (error === undefined) return null;
  return (
    <p id={`${id}-error`} role="alert" className="text-sm text-danger">
      {error}
    </p>
  );
}

export interface TextFieldProps {
  id: string;
  label: string;
  type: string;
  value: string;
  error: string | undefined;
  onChange: (v: string) => void;
}

export function TextField({ id, label, type, value, error, onChange }: TextFieldProps) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        autoComplete="off"
        value={value}
        aria-invalid={error !== undefined}
        aria-describedby={error === undefined ? undefined : `${id}-error`}
        className="h-12"
        onChange={(e) => {
          onChange(e.target.value);
        }}
      />
      <FieldError id={id} error={error} />
    </div>
  );
}

export interface PickerProps {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  /** Fixed value (shown, not changeable). */
  locked?: boolean;
  error?: string | undefined;
  onChange: (v: string) => void;
}

export function PickerField({ id, label, value, options, locked, error, onChange }: PickerProps) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={locked === true}>
        <SelectTrigger id={id} className="h-12 w-full" aria-invalid={error !== undefined}>
          <SelectValue placeholder="Choose…" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} className="min-h-12">
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldError id={id} error={error} />
    </div>
  );
}
