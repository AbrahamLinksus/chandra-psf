import type { RepoError } from "@/data/access";

export const NAME_IN_USE_MESSAGE = "A branch with this name already exists";

/** Inline message for a failed branch / advisor save; null when it is not a field problem. */
export function fieldMessage(error: RepoError, what: "branch" | "advisor"): string | null {
  if (error.code === "NAME_IN_USE") {
    return what === "branch" ? NAME_IN_USE_MESSAGE : "An advisor with this name already exists";
  }
  if (error.code === "VALIDATION") {
    return what === "branch" ? "Enter a branch name and city" : "Enter a name";
  }
  return null;
}
