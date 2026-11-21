export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "ALREADY_COMPLETED"
  | "BAD_CREDENTIALS"
  | "ACCOUNT_DISABLED"
  | "BAD_PASSWORD"
  | "EMAIL_IN_USE"
  | "SAVE_FAILED"
  | "UNAVAILABLE";

export interface RepoError {
  code: ErrorCode;
  message: string;
  fields?: string[];
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: RepoError };

export interface StepUp {
  password: string;
}

export type Topic = "session" | "visits" | "responses" | "alerts" | "audit" | "users";

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err<T = never>(code: ErrorCode, message: string, fields?: string[]): Result<T> {
  const error: RepoError = fields === undefined ? { code, message } : { code, message, fields };
  return { ok: false, error };
}
