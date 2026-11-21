/** Fixed inputs of the seed (SPEC 6): people, models, scripted rows. No logic here. */
import type { Seed } from "../../src/domain/schemas";
import { extra, type SurveyRow } from "./answers";

export const SEED_VALUE = 20_261_121;
export const RESPONSE_DAY_SPAN = 88;

export const MODELS = [
  { model: "Activa 6G", vehicleType: "scooter" },
  { model: "Dio", vehicleType: "scooter" },
  { model: "Shine", vehicleType: "motorcycle" },
  { model: "SP125", vehicleType: "motorcycle" },
  { model: "Unicorn", vehicleType: "motorcycle" },
] as const;

export const ADVISORS = [
  { id: "a-suresh", name: "Suresh" },
  { id: "a-ganesh", name: "Ganesh" },
  { id: "a-anand", name: "Anand" },
  { id: "a-bhavani", name: "Bhavani" },
];

export const SERVICE_TYPES = ["Free service", "Paid service", "Running repair"];

export const USERS = [
  { id: "u-admin", name: "Admin", email: "admin@chandrahonda.demo", role: "admin" },
  { id: "u-support1", name: "Support 1", email: "support1@chandrahonda.demo", role: "support" },
  { id: "u-support2", name: "Support 2", email: "support2@chandrahonda.demo", role: "support" },
] as const;

/** 2-3 extra responses with a rating of 1 (SPEC 6); Q1..Q13 in order. */
export const EXTRA_ROWS: SurveyRow[] = [
  extra(
    "EXTRA-01",
    "Vikram S",
    [1, "No", "Yes", "No", "No", 2, "No", "No", "No", "No", 3, 1, "No"],
    "Work was not done properly, the problem is still there.",
  ),
  extra(
    "EXTRA-02",
    "Pooja R",
    [3, "Partially", "No", "No", "Yes", 1, "Yes", "Yes", "Yes", "Yes", 7, 3, "Yes"],
    "The advisor was rude and did not listen.",
  ),
  extra(
    "EXTRA-03",
    "Hari N",
    [4, "Yes", "No", "Yes", "Yes", 4, "Yes", "Yes", "Yes", "No", 1, 2, "No"],
    "Charges were much higher than the estimate.",
  ),
];

export const ALERT_PLAN: Record<
  string,
  { status: Seed["alerts"][number]["status"]; note: string }
> = {
  "CUST-014": { status: "contacted", note: "Called customer, vehicle will be rechecked." },
  "EXTRA-01": { status: "contacted", note: "Advisor to call back and book a recheck." },
  "EXTRA-02": { status: "resolved", note: "Spoke to the customer, advisor coached." },
};

/** Unanswered visits: link created `offset` days before the load day; expired ones are > 7 days old. */
export const UNANSWERED = [
  ...[-9, -14, -21, -35].map((offset) => ({ offset, kind: "expired" as const })),
  ...[-2, -4, -5].map((offset) => ({ offset, kind: "opened" as const })),
  ...[-1, -2, -4].map((offset) => ({ offset, kind: "created" as const })),
];
export const UNANSWERED_NAMES = [
  "Jagan M",
  "Kalai Selvi",
  "Loganathan P",
  "Malar V",
  "Naresh B",
  "Oviya S",
  "Parthiban K",
  "Qadir H",
  "Rohini T",
  "Sathya N",
];

/** Fresh job cards (no visit yet) so "Generate link" always has something to show (S-07). */
export const FRESH_OFFSETS = [-1, -2, -3, -4, -5, -6, -8, -9, -2];
export const FRESH_NAMES = [
  "Anil Menon",
  "Bharathi S",
  "Chitra Devi",
  "Dhanush R",
  "Elango K",
  "Fathima B",
  "Gopal N",
  "Hema Latha",
  "Imran Khan",
];
