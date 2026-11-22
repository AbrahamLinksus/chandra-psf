"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Question } from "@/domain/questionnaire";
import type { AnswerValue } from "@/domain/types";

interface FieldProps {
  question: Question;
  value: AnswerValue | undefined;
  onChange: (v: AnswerValue) => void;
}

const RATINGS = [1, 2, 3, 4, 5];
const YES_NO = ["Yes", "No"];
const YES_PARTIAL_NO = ["Yes", "Partially", "No"];

function choicesOf(q: Question): (string | number)[] {
  if (q.type === "rating_5") return RATINGS;
  if (q.type === "yes_no") return YES_NO;
  if (q.type === "yes_partial_no") return YES_PARTIAL_NO;
  return q.options ?? [];
}

function ChoiceField({ question, value, onChange }: FieldProps) {
  return (
    <div role="group" aria-label={question.text} className="flex flex-wrap gap-2">
      {choicesOf(question).map((c) => (
        <Button
          key={c}
          type="button"
          variant={value === c ? "default" : "outline"}
          aria-pressed={value === c}
          className="h-12 min-w-12"
          onClick={() => {
            onChange(c);
          }}
        >
          {c}
        </Button>
      ))}
    </div>
  );
}

function TextField({ question, value, onChange }: FieldProps) {
  return (
    <Textarea
      aria-label={question.text}
      maxLength={question.maxLength}
      value={typeof value === "string" ? value : ""}
      onChange={(e) => {
        onChange(e.target.value);
      }}
    />
  );
}

function MultiField({ question, value, onChange }: FieldProps) {
  const current = typeof value === "object" ? value : { options: [] };
  const toggle = (o: string) => {
    const options = current.options.includes(o)
      ? current.options.filter((x) => x !== o)
      : [...current.options, o];
    onChange({ ...current, options });
  };
  return (
    <div className="grid gap-2">
      {(question.options ?? []).map((o) => (
        <Label key={o} className="min-h-12 gap-3 text-base font-normal">
          <input
            type="checkbox"
            className="size-5"
            checked={current.options.includes(o)}
            onChange={() => {
              toggle(o);
            }}
          />
          {o}
        </Label>
      ))}
      <Textarea
        aria-label={`${question.text} (details)`}
        maxLength={question.maxLength}
        value={current.text ?? ""}
        onChange={(e) => {
          onChange({ ...current, text: e.target.value });
        }}
      />
    </div>
  );
}

const FIELDS: Record<Question["type"], (p: FieldProps) => React.JSX.Element> = {
  rating_5: ChoiceField,
  yes_no: ChoiceField,
  yes_partial_no: ChoiceField,
  single_select: ChoiceField,
  text: TextField,
  multi_select_text: MultiField,
};

export function EditField(props: FieldProps) {
  const Field = FIELDS[props.question.type];
  return <Field {...props} />;
}
