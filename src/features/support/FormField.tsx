import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

interface Props {
  id: string;
  label: string;
  error?: string | undefined;
  hint?: string;
  children: ReactNode;
}

/** Label, control and an inline error for one form field. */
export function FormField({ id, label, error, hint, children }: Props) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint !== undefined && error === undefined && (
        <p className="text-sm text-muted-foreground">{hint}</p>
      )}
      {error !== undefined && (
        <p id={`${id}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export const SELECT_CLASS =
  "h-12 w-full rounded-md border border-input bg-transparent px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive";
