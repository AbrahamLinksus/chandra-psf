import "server-only";
import { err, type Result } from "@/data/access/result";

/** Foundation placeholder: replaced by the slice that owns the repo (no stub survives a milestone). */
export function unavailable<T>(): Promise<Result<T>> {
  return Promise.resolve(err("UNAVAILABLE", "Not available yet."));
}
