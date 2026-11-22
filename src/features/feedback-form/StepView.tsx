import type { AnswerMap, AnswerValue, QuestionCode } from "@/domain/types";
import { QUESTIONNAIRE_V1, type Question } from "@/domain/questionnaire";
import { isVisible } from "@/domain/visibility";
import { FIELD_REGISTRY } from "./fieldRegistry";
import { Reveal } from "./Reveal";

export interface StepViewProps {
  step: number;
  answers: AnswerMap;
  onAnswer: (code: QuestionCode, value: AnswerValue) => void;
}

interface QuestionBlockProps {
  question: Question;
  value: AnswerValue | undefined;
  onAnswer: StepViewProps["onAnswer"];
}

/** The first focusable control of the parent question, where focus lands when a follow-up collapses. */
function focusableOf(code: QuestionCode): HTMLElement | null {
  const block = document.querySelector(`[data-question="${code}"]`);
  return (
    block?.querySelector<HTMLElement>("input:checked, input, button, textarea, select") ?? null
  );
}

function QuestionBlock({ question: q, value, onAnswer }: QuestionBlockProps) {
  const Field = FIELD_REGISTRY[q.type];
  return (
    <div data-question={q.code} className="space-y-2">
      <p className="font-medium">{q.text}</p>
      <Field
        question={q}
        value={value}
        onChange={(v) => {
          onAnswer(q.code, v);
        }}
      />
    </div>
  );
}

/** One category: visible questions only; follow-ups slide open and closed as they come and go. */
export function StepView({ step, answers, onAnswer }: StepViewProps) {
  const title = QUESTIONNAIRE_V1.steps.find((s) => s.n === step)?.title ?? "";
  const questions = QUESTIONNAIRE_V1.questions.filter((q) => q.step === step);
  return (
    <section>
      <h2 className="text-lg font-semibold">{title}</h2>
      {questions.map((q) =>
        q.parent === undefined ? (
          <div key={q.code} className="mt-5">
            <QuestionBlock question={q} value={answers[q.code]} onAnswer={onAnswer} />
          </div>
        ) : (
          <Reveal
            key={q.code}
            open={isVisible(q, answers)}
            value={answers[q.code]}
            returnFocusTo={() => (q.parent === undefined ? null : focusableOf(q.parent))}
          >
            {(value) => (
              <div className="pt-5">
                <div className="border-l-2 border-primary/40 pl-3">
                  <QuestionBlock question={q} value={value} onAnswer={onAnswer} />
                </div>
              </div>
            )}
          </Reveal>
        ),
      )}
    </section>
  );
}
