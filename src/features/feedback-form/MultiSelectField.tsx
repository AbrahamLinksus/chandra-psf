import { TEXT_MAX_LENGTH } from "@/domain/constants";
import { cn } from "@/lib/utils";
import type { FieldProps } from "./fieldTypes";
import { TextBox } from "./TextField";

function current(value: FieldProps["value"]): { options: string[]; text?: string } {
  return typeof value === "object" ? value : { options: [] };
}

export function MultiSelectField({ question, value, onChange }: FieldProps) {
  const { options, text = "" } = current(value);
  const emit = (nextOptions: string[], nextText: string) => {
    onChange(nextText === "" ? { options: nextOptions } : { options: nextOptions, text: nextText });
  };
  const toggle = (opt: string) => {
    emit(options.includes(opt) ? options.filter((o) => o !== opt) : [...options, opt], text);
  };
  return (
    <div className="space-y-3">
      <div role="group" aria-label={question.text} className="flex flex-wrap gap-2">
        {(question.options ?? []).map((opt) => (
          <button
            key={opt}
            type="button"
            aria-pressed={options.includes(opt)}
            onClick={() => {
              toggle(opt);
            }}
            className={cn(
              "min-h-12 rounded-full border px-4 text-base",
              options.includes(opt)
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-card hover:bg-accent",
            )}
          >
            {opt}
          </button>
        ))}
      </div>
      <TextBox
        label={question.textRequired === true ? "Tell us more" : "Tell us more (optional)"}
        value={text}
        max={question.maxLength ?? TEXT_MAX_LENGTH}
        onChange={(t) => {
          emit(options, t);
        }}
      />
    </div>
  );
}
