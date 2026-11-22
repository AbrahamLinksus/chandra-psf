import { EditField } from "./EditFields";
import { answerText } from "./answerText";
import type { Questionnaire } from "@/domain/questionnaire";
import type { AnswerMap, AnswerValue, QuestionCode } from "@/domain/types";
import { isVisible } from "@/domain/visibility";

export interface AnswerListProps {
  questionnaire: Questionnaire;
  answers: AnswerMap;
  /** When set, answers render as inputs; follow-ups appear and disappear live. */
  onChange?: (code: QuestionCode, v: AnswerValue) => void;
}

/** Every visible answer grouped by step. User text is rendered as plain text only. */
export function AnswerList({ questionnaire, answers, onChange }: AnswerListProps) {
  return (
    <div className="grid gap-6">
      {questionnaire.steps.map((step) => {
        const questions = questionnaire.questions.filter(
          (q) => q.step === step.n && isVisible(q, answers),
        );
        return (
          <section key={step.n} aria-label={step.title} className="grid gap-3">
            <h3 className="font-semibold">{step.title}</h3>
            {questions.map((q) => (
              <div key={q.code} data-question={q.code} className="grid gap-1.5">
                <p className="text-sm text-muted-foreground">{q.text}</p>
                {onChange === undefined ? (
                  <p className="font-medium break-words whitespace-pre-wrap">
                    {answerText(answers[q.code])}
                  </p>
                ) : (
                  <EditField
                    question={q}
                    value={answers[q.code]}
                    onChange={(v) => {
                      onChange(q.code, v);
                    }}
                  />
                )}
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}
