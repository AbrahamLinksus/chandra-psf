import { cn } from "@/lib/utils";
import { RATING_FACES, type FieldProps } from "./fieldTypes";

export function RatingField({ question, value, onChange }: FieldProps) {
  return (
    <div role="group" aria-label={question.text} className="grid grid-cols-5 gap-1.5">
      {RATING_FACES.map((f) => (
        <button
          key={f.value}
          type="button"
          aria-pressed={value === f.value}
          aria-label={`${String(f.value)} ${f.label}`}
          onClick={() => {
            onChange(f.value);
          }}
          className={cn(
            "flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-lg border px-0.5 py-2 text-[11px] leading-tight",
            value === f.value
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input bg-card hover:bg-accent",
          )}
        >
          <span className="text-2xl" aria-hidden>
            {f.face}
          </span>
          <span>{f.label}</span>
        </button>
      ))}
    </div>
  );
}
