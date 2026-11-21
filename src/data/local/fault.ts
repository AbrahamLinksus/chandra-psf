const FAULT_KEY = "psf:fault";

type SessionStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Simulated failed save (S-13). Kept in sessionStorage so it is per tab and survives a reload. */
export class FaultSwitch {
  constructor(private readonly session: SessionStore) {}

  armNextWrite(): void {
    this.session.setItem(FAULT_KEY, "1");
  }

  /** True once per arming: the next write must fail. */
  consume(): boolean {
    if (this.session.getItem(FAULT_KEY) === null) return false;
    this.session.removeItem(FAULT_KEY);
    return true;
  }

  /** `?demoFail=1` arms the switch. */
  armFromSearch(search: string): void {
    if (new URLSearchParams(search).get("demoFail") === "1") this.armNextWrite();
  }
}
