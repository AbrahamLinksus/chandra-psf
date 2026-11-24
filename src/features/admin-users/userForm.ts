import type { RepoError } from "@/data/access";
import type { Role, User } from "@/domain/types";

export interface UserDraft {
  name: string;
  email: string;
  tempPassword: string;
  role: Role;
  /** "" = no branch chosen. */
  branchId: string;
}

export type DraftKey = keyof UserDraft;
export type FieldErrors = Partial<Record<DraftKey, string>>;

export const ROLE_LABELS: Record<Role, string> = {
  support: "Support",
  branch_admin: "Branch admin",
  main_admin: "Main admin",
};
export const ALL_ROLES: Role[] = ["support", "branch_admin", "main_admin"];

const FIELD_MESSAGES: Record<DraftKey, string> = {
  name: "Enter a name",
  email: "Enter a valid email address",
  tempPassword: "Use at least 8 characters",
  role: "Choose a role",
  branchId: "Choose a branch",
};

const isDraftKey = (f: string): f is DraftKey => f in FIELD_MESSAGES;

/** Maps a VALIDATION / EMAIL_IN_USE error to per-field messages (server wording when one field). */
export function toFieldErrors(error: RepoError): FieldErrors {
  const fields = (error.fields ?? []).filter(isDraftKey);
  const errors: FieldErrors = {};
  for (const f of fields) errors[f] = fields.length === 1 ? error.message : FIELD_MESSAGES[f];
  return errors;
}

export const isFieldError = (e: RepoError): boolean =>
  (e.code === "VALIDATION" || e.code === "EMAIL_IN_USE") && (e.fields?.length ?? 0) > 0;

export const draftFromUser = (u: User): UserDraft => ({
  name: u.name,
  email: u.email,
  tempPassword: "",
  role: u.role,
  branchId: u.branchId ?? "",
});

export const EMPTY_DRAFT: UserDraft = {
  name: "",
  email: "",
  tempPassword: "",
  role: "support",
  branchId: "",
};
