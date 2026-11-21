import { TEXT_MAX_LENGTH } from "./constants";
import type { QuestionCode } from "./types";

export type QuestionType =
  "rating_5" | "yes_no" | "yes_partial_no" | "text" | "single_select" | "multi_select_text";

export type ShowIf =
  | { op: "lte" | "gte"; value: number }
  | { op: "eq"; value: number | string }
  | { op: "in"; value: string[] };

export interface Question {
  code: QuestionCode;
  step: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  type: QuestionType;
  required: boolean;
  parent?: QuestionCode;
  showIf?: ShowIf;
  options?: string[];
  maxLength?: number;
  textRequired?: boolean;
}

export interface Questionnaire {
  version: number;
  steps: { n: number; title: string }[];
  questions: Question[];
}

type Base = Pick<Question, "code" | "step" | "text">;

const rating = (b: Base): Question => ({ ...b, type: "rating_5", required: true });
const yesNo = (b: Base): Question => ({ ...b, type: "yes_no", required: true });
const followUp = (b: Base, parent: QuestionCode, showIf: ShowIf, options: string[]): Question => ({
  ...b,
  type: "multi_select_text",
  required: true,
  parent,
  showIf,
  options,
  maxLength: TEXT_MAX_LENGTH,
});
const textFollowUp = (b: Base, parent: QuestionCode, showIf: ShowIf): Question => ({
  ...b,
  type: "text",
  required: true,
  parent,
  showIf,
  maxLength: TEXT_MAX_LENGTH,
});

const LOW: ShowIf = { op: "lte", value: 3 };
const NO: ShowIf = { op: "eq", value: "No" };
const YES: ShowIf = { op: "eq", value: "Yes" };

export const QUESTIONNAIRE_V1: Questionnaire = {
  version: 1,
  steps: [
    { n: 1, title: "Service Quality & Complaint Resolution" },
    { n: 2, title: "Customer Interaction & Communication" },
    { n: 3, title: "Timelines & Vehicle Delivery" },
    { n: 4, title: "Pricing & Value for Money" },
    { n: 5, title: "Overall Satisfaction & Loyalty" },
    { n: 6, title: "Callback" },
  ],
  questions: [
    rating({
      code: "Q1",
      step: 1,
      text: "Are you satisfied with the quality of work carried out on your vehicle?",
    }),
    followUp({ code: "Q1a", step: 1, text: "What was wrong with the work?" }, "Q1", LOW, [
      "Problem not fixed",
      "Same problem came back",
      "New problem appeared",
      "Other",
    ]),
    {
      code: "Q2",
      step: 1,
      text: "Were all the complaints reported by you rectified?",
      type: "yes_partial_no",
      required: true,
    },
    textFollowUp({ code: "Q2a", step: 1, text: "Which complaint wasn't fixed?" }, "Q2", {
      op: "in",
      value: ["Partially", "No"],
    }),
    yesNo({
      code: "Q3",
      step: 1,
      text: "Did you face any issues after taking delivery of your vehicle?",
    }),
    followUp({ code: "Q3a", step: 1, text: "What issue did you face?" }, "Q3", YES, [
      "Engine",
      "Brakes",
      "Electrical",
      "Body & paint",
      "Other",
    ]),
    yesNo({
      code: "Q4",
      step: 2,
      text: "Did the Service Advisor explain the work completed on your vehicle?",
    }),
    yesNo({ code: "Q5", step: 2, text: "Were you informed about the next service due date?" }),
    rating({
      code: "Q6",
      step: 2,
      text: "Were you satisfied with the behaviour of the Service Advisor?",
    }),
    followUp({ code: "Q6a", step: 2, text: "What was the problem with the advisor?" }, "Q6", LOW, [
      "Rude",
      "Not attentive",
      "Didn't answer queries",
      "Other",
    ]),
    yesNo({ code: "Q7", step: 3, text: "Was your vehicle delivered on the promised time?" }),
    {
      code: "Q7a",
      step: 3,
      text: "How late was the delivery?",
      type: "single_select",
      required: true,
      parent: "Q7",
      showIf: NO,
      options: ["Same day", "1 day late", "2+ days late"],
    },
    yesNo({ code: "Q8", step: 3, text: "Was the vehicle properly washed and cleaned?" }),
    yesNo({ code: "Q9", step: 3, text: "Was the vehicle delivered in good condition?" }),
    followUp({ code: "Q9a", step: 3, text: "What was the problem?" }, "Q9", NO, [
      "Scratch or dent",
      "Missing item",
      "Dirty",
      "Other",
    ]),
    yesNo({ code: "Q10", step: 4, text: "Were the service charges explained clearly?" }),
    rating({ code: "Q11", step: 4, text: "Were the service charges affordable?" }),
    followUp({ code: "Q11a", step: 4, text: "What felt expensive?" }, "Q11", LOW, [
      "Labour",
      "Parts",
      "Extra work not agreed",
      "Other",
    ]),
    rating({
      code: "Q12",
      step: 5,
      text: "Were you satisfied with the overall service experience?",
    }),
    yesNo({
      code: "Q13",
      step: 5,
      text: "Would you recommend Chandra Honda to your friends and family?",
    }),
    textFollowUp({ code: "Q13a", step: 5, text: "What's the main reason?" }, "Q13", NO),
    {
      code: "Q14",
      step: 5,
      text: "Do you have any additional feedback or suggestions?",
      type: "text",
      required: false,
      maxLength: TEXT_MAX_LENGTH,
    },
    yesNo({
      code: "Q15",
      step: 6,
      text: "Would you like someone from our service team to call you?",
    }),
  ],
};

export function findQuestion(
  code: QuestionCode,
  q: Questionnaire = QUESTIONNAIRE_V1,
): Question | undefined {
  return q.questions.find((x) => x.code === code);
}
