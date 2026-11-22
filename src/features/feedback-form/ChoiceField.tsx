import { cn } from "@/lib/utils";
import { choiceOptions, type FieldProps } from "./fieldTypes";

export function ChoiceField({ question, value, onChange }: FieldProps) {
  return (
    <div role="group" aria-label={question.text} className="flex flex-wrap gap-2">
      {choiceOptions(question).map((opt) => (
        <button
          key={opt}
          type="button"
          aria-pressed={value === opt}
          onClick={() => {
            onChange(opt);
          }}
          className={cn(
            "min-h-12 min-w-24 flex-1 rounded-full border px-5 text-base font-medium",
            value === opt
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input bg-card hover:bg-accent",
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
