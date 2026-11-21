import type { Clock } from "./db";
import type { SessionReader } from "./session";
import type { LocalStore } from "./store";

/** Constructor dependencies of every local repository (CONVENTIONS 3, dependency inversion). */
export interface RepoDeps {
  store: LocalStore;
  clock: Clock;
  session: SessionReader;
}
