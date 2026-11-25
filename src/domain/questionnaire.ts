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

const LOW: ShowIf = { op: "lte", value: 2 };
const NO: ShowIf = { op: "eq", value: "No" };
const YES: ShowIf = { op: "eq", value: "Yes" };

const singleSelect = (
  b: Base,
  parent: QuestionCode,
  showIf: ShowIf,
  options: string[],
): Question => ({
  ...b,
  type: "single_select",
  required: true,
  parent,
  showIf,
  options,
});

export const CALLBACK_SLOTS = [
  "Morning (9 AM–12 PM)",
  "Afternoon (12 PM–3 PM)",
  "Evening (3 PM–6 PM)",
];

/** Customer-form storage and submissions are tied to this version (v1 is dropped, CR-2). */
export const QUESTIONNAIRE_V2: Questionnaire = {
  version: 2,
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
      text: "Were you satisfied with the overall service experience?",
    }),
    followUp(
      { code: "Q1a", step: 1, text: "What was the concern with the service work?" },
      "Q1",
      LOW,
      [
        "Complaint not resolved",
        "Same issue recurred",
        "New issue noticed after service",
        "Poor workmanship",
        "Other",
      ],
    ),
    {
      code: "Q2",
      step: 1,
      text: "Were all the complaints reported by you rectified?",
      type: "yes_partial_no",
      required: true,
    },
    textFollowUp({ code: "Q2a", step: 1, text: "Which complaint(s) remain unresolved?" }, "Q2", {
      op: "in",
      value: ["Partially", "No"],
    }),
    yesNo({
      code: "Q3",
      step: 1,
      text: "Did you face any issues after taking delivery of your vehicle?",
    }),
    followUp({ code: "Q3a", step: 1, text: "What type of issue did you experience?" }, "Q3", YES, [
      "Engine / Starting",
      "Brakes",
      "Electrical / Battery",
      "Lights / Indicators",
      "Clutch / Gear",
      "Suspension",
      "Tyres / Wheels",
      "Noise / Vibration",
      "Other",
    ]),
    rating({
      code: "Q4",
      step: 2,
      text: "Were you satisfied with the behaviour of the Service Advisor?",
    }),
    followUp({ code: "Q4a", step: 2, text: "What was the concern?" }, "Q4", LOW, [
      "Unprofessional / Rude Behaviour",
      "Not Attentive",
      "Unable to Explain Queries",
      "Delayed Response",
      "Lack of Follow-up",
      "Other",
    ]),
    yesNo({ code: "Q5", step: 3, text: "Was your vehicle delivered on the promised time?" }),
    singleSelect({ code: "Q5a", step: 3, text: "How late was the delivery?" }, "Q5", NO, [
      "2–4 Hours",
      "More than 4 Hours (Same Day)",
      "1 Day",
      "More than 1 Day",
    ]),
    yesNo({ code: "Q6", step: 3, text: "Was the vehicle delivered in good condition?" }),
    followUp({ code: "Q6a", step: 3, text: "What was the concern?" }, "Q6", NO, [
      "Scratches / Dents",
      "Missing Parts / Accessories",
      "Improper Cleaning",
      "Damage During Service",
      "Other",
    ]),
    yesNo({ code: "Q7", step: 4, text: "Were the service charges explained clearly?" }),
    rating({ code: "Q8", step: 4, text: "Were the service charges affordable?" }),
    followUp({ code: "Q8a", step: 4, text: "Which component did you find expensive?" }, "Q8", LOW, [
      "Labour Charges",
      "Spare Parts",
      "Engine Oil / Lubricants",
      "Consumables",
      "Additional / Unapproved Work",
      "Overall Service Cost",
      "Other",
    ]),
    yesNo({
      code: "Q9",
      step: 5,
      text: "Would you recommend Chandra Honda to your friends and family?",
    }),
    singleSelect(
      { code: "Q9a", step: 5, text: "What is the primary reason for your response?" },
      "Q9",
      { op: "in", value: ["Yes", "No"] },
      [
        "Quality of Service",
        "Staff Behaviour",
        "Timely Delivery",
        "Reasonable Pricing",
        "Trust & Reliability",
        "Overall Experience",
        "Other",
      ],
    ),
    yesNo({
      code: "Q10",
      step: 6,
      text: "Would you like someone from our Service team to call you?",
    }),
    singleSelect(
      { code: "Q10a", step: 6, text: "When should we call you?" },
      "Q10",
      YES,
      CALLBACK_SLOTS,
    ),
  ],
};

export function findQuestion(
  code: QuestionCode,
  q: Questionnaire = QUESTIONNAIRE_V2,
): Question | undefined {
  return q.questions.find((x) => x.code === code);
}
