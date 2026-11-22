import { Textarea } from "@/components/ui/textarea";
import { TEXT_MAX_LENGTH } from "@/domain/constants";
import type { FieldProps } from "./fieldTypes";

export interface TextBoxProps {
  label: string;
  value: string;
  max: number;
  onChange: (text: string) => void;
}

const segmenter = new Intl.Segmenter();

/**
 * Cuts to at most `max` UTF-16 units (what the domain validation counts) without splitting an
 * emoji, surrogate pair or other grapheme.
 */
export function clampText(text: string, max: number): string {
  if (text.length <= max) return text;
  let out = "";
  for (const { segment } of segmenter.segment(text)) {
    if (out.length + segment.length > max) break;
    out += segment;
  }
  return out;
}

/** Plain-text box with an `n/1000` counter; React renders the text, never as HTML. */
export function TextBox({ label, value, max, onChange }: TextBoxProps) {
  return (
    <div className="space-y-1">
      <Textarea
        aria-label={label}
        value={value}
        rows={3}
        className="min-h-24"
        onChange={(e) => {
          onChange(clampText(e.target.value, max));
        }}
      />
      <p className="text-right text-xs text-muted-foreground">
        {value.length}/{max}
      </p>
    </div>
  );
}

export function TextField({ question, value, onChange }: FieldProps) {
  const text = typeof value === "string" ? value : "";
  const label = question.required ? question.text : `${question.text} (optional)`;
  return (
    <TextBox
      label={label}
      value={text}
      max={question.maxLength ?? TEXT_MAX_LENGTH}
      onChange={onChange}
    />
  );
}
