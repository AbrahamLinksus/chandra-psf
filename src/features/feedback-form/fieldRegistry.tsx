import type { QuestionType } from "@/domain/questionnaire";
import { ChoiceField } from "./ChoiceField";
import type { FieldProps } from "./fieldTypes";
import { MultiSelectField } from "./MultiSelectField";
import { RatingField } from "./RatingField";
import { TextField } from "./TextField";

export type FieldComponent = (props: FieldProps) => React.JSX.Element;

/** New question type = new field file + one entry here. */
export const FIELD_REGISTRY: Record<QuestionType, FieldComponent> = {
  rating_5: RatingField,
  yes_no: ChoiceField,
  yes_partial_no: ChoiceField,
  single_select: ChoiceField,
  multi_select_text: MultiSelectField,
  text: TextField,
};
