import type { Result } from "../result";

export interface DemoRepo {
  resetDemoData(): Promise<Result<void>>;
  armFailedSave(): Promise<Result<void>>;
}
