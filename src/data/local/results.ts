import { err, type Result } from "@/data/access/result";

export const SAVE_FAILED_MESSAGE = "Couldn't save, try again";

/** Runs a write; any throw (incl. simulated or quota failures) becomes SAVE_FAILED. */
export async function guardWrite<T>(fn: () => Promise<Result<T>>): Promise<Result<T>> {
  try {
    return await fn();
  } catch {
    return err("SAVE_FAILED", SAVE_FAILED_MESSAGE);
  }
}

/** Runs a read; any throw becomes UNAVAILABLE. */
export async function guardRead<T>(fn: () => Promise<Result<T>>): Promise<Result<T>> {
  try {
    return await fn();
  } catch {
    return err("UNAVAILABLE", "Data is unavailable right now");
  }
}

/** Foundation placeholder for repository methods a later task builds. */
export function notBuilt<T>(): Promise<Result<T>> {
  return Promise.resolve(err("UNAVAILABLE", "Not built yet"));
}
